import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {pathToFileURL} from 'node:url';

const pages=new Set(['/chamados','/historico','/fechamento','/minuta','/api-explorer']);
const staticRoutes=new Set(['/cases.js','/cases.css','/history.js','/closing.js','/closing.css','/draft.js','/draft.css','/api-explorer.js','/api-explorer.css']);
const readApis=new Set(['/api/cases','/api/cases/runtime','/api/cases/history','/api/cases/history/media','/api/cases/closing','/api/cases/closing/draft','/api/cases/closing/cover']);
const writes=new Map([
  ['/api/cases/history',new Set(['assign','ignore','restore','prepare','recheck'])],
  ['/api/cases/closing',new Set(['sources','review','settings','preventives'])],
  ['/api/cases/closing/context',null],['/api/cases/closing/local',null],['/api/cases/closing/package',null]
]);
const caseRoute=/^\/api\/cases\/R-[A-F0-9]{8}$/;
const mediaRoute=/^\/api\/cases\/R-[A-F0-9]{8}\/(?:media|attachment)\/\d{1,4}$/;
const photoRoute=/^\/api\/cases\/R-[A-F0-9]{8}\/photo$/;
const edits=new Set(['profile','context','note','task','resolve','merge','archive','restore']);
const maxBody=24576;
const cookieName='__Host-remote_case';
const csp="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; media-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";
const reply=(res,status,error)=>res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'}).end(JSON.stringify({error}));

function remotePage(html){
  return html.replaceAll('href="/">Configuração','href="/configuracao">Configuração')
    .replace('<a href="/#arquivo">Importar mais registros</a>','<a href="/configuracao#arquivo">Importação no computador</a>')
    .replace('ACOMPANHAMENTO LOCAL','ACESSO PRIVADO')
    .replace('Dados neste computador','Dados no computador do coletor');
}
const settingsAssets=new Map([
  ['/configuracao',['private-settings.html','text/html']],
  ['/private-settings.js',['private-settings.js','text/javascript']]
]);

export function createPrivatePanel({host,login,collectorPort=8767,fetcher=fetch}){
  const authority=/^[a-z0-9-]{1,63}\.[a-z0-9-]{1,63}\.ts\.net(?::([1-9]\d{0,4}))?$/.exec(host||'');
  const httpsPort=Number(authority?.[1]||443);
  if(!authority||(authority[1]&&(httpsPort<1024||httpsPort>65535))||
     typeof login!=='string'||!/^\S+@\S+$/.test(login)||login.length>254||
     !Number.isInteger(collectorPort)||collectorPort<1024||collectorPort>65535)throw Error('Configure hostname Tailscale, login exato e porta local válidos.');
  const origin='https://'+host,collector='http://127.0.0.1:'+collectorPort;
  const server=createServer({requestTimeout:15000,headersTimeout:10000,maxHeaderSize:8192},async(req,res)=>{
    res.setHeader('Content-Security-Policy',csp);
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    if(req.socket.remoteAddress!=='127.0.0.1'||req.headers.host!==host||
       req.headers['x-forwarded-proto']!=='https'||req.headers['tailscale-user-login']!==login){
      return reply(res,403,'Acesso restrito à conta autorizada via Tailscale HTTPS.');
    }
    try{
      const raw=req.url||'';
      if(!raw.startsWith('/')||raw.startsWith('//')||raw.length>2300||/[\\#]/.test(raw))return reply(res,400,'Endereço inválido.');
      const url=new URL(raw,origin),path=url.pathname;
      if(url.origin!==origin||path!==raw.split('?')[0])return reply(res,400,'Endereço inválido.');
      if(req.method==='GET'&&path==='/')return res.writeHead(302,{Location:'/chamados'}).end();
      if(req.method==='GET'&&path==='/private-settings.js'){
        const [file,type]=settingsAssets.get(path);
        return res.writeHead(200,{'Content-Type':type+'; charset=utf-8'}).end(await readFile(new URL('../web/'+file,import.meta.url)));
      }
      const settings=req.method==='GET'&&path==='/configuracao';
      const read=req.method==='GET'&&(settings||pages.has(path)||staticRoutes.has(path)||readApis.has(path)||caseRoute.test(path)||mediaRoute.test(path));
      const photo=req.method==='POST'&&photoRoute.test(path);
      const write=req.method==='POST'&&(caseRoute.test(path)||writes.has(path)||photo);
      if(!read&&!write)return reply(res,404,'Rota não disponível no acesso remoto.');
      const headers={};
      const match=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1);
      if(/^[a-f0-9]{64}$/.test(match||''))headers.cookie='case_session='+match;
      if(read&&(mediaRoute.test(path)||path==='/api/cases/history/media')&&/^bytes=\d{0,16}-\d{0,16}$/.test(req.headers.range||''))headers.range=req.headers.range;
      let body;
      if(write){
        const type=req.headers['content-type'],limit=photo?5*1024*1024:maxBody;
        if(req.headers.origin!==origin||!headers.cookie||
           (photo?!['image/jpeg','image/png','image/webp'].includes(type):type!=='application/json'))return reply(res,403,'Edição não autorizada.');
        if(Number(req.headers['content-length'])>limit)return reply(res,413,'Atualização acima do limite.');
        const chunks=[];let length=0;
        for await(const chunk of req){
          length+=chunk.length;if(length>limit){req.resume();return reply(res,413,'Atualização acima do limite.');}chunks.push(chunk);
        }
        body=Buffer.concat(chunks);
        if(!photo){
          let input;
          try{input=JSON.parse(body.toString('utf8'));}catch{return reply(res,400,'Atualização inválida.');}
          const allowed=caseRoute.test(path)?edits:writes.get(path);
          if(!input||Array.isArray(input)||typeof input!=='object'||(allowed&&!allowed.has(input.kind)))return reply(res,403,'Operação não autorizada para esta rota.');
        }
        headers.origin=collector;
        headers['content-type']=type;
      }
      const timeout=path==='/api/cases/closing/local'?920000:path==='/api/cases/closing/package'||headers.range?120000:30000;
      const response=await fetcher(collector+(settings?'/chamados':path)+url.search,{method:req.method,headers,body,redirect:'error',signal:AbortSignal.timeout(timeout)});
      for(const key of ['content-type','content-disposition','content-range','accept-ranges','cross-origin-resource-policy']){
        const value=response.headers.get(key);if(value)res.setHeader(key,value);
      }
      if(path==='/api/cases/history/media'||mediaRoute.test(path))res.setHeader('Content-Security-Policy',"sandbox; default-src 'none'");
      const token=response.headers.get('set-cookie')?.match(/^case_session=([a-f0-9]{64});/)?.[1];
      if((settings||pages.has(path))&&token)res.setHeader('Set-Cookie',cookieName+'='+token+'; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200');
      if(settings&&response.ok){
        await response.body?.cancel();
        const [file,type]=settingsAssets.get(path);
        return res.writeHead(200,{'Content-Type':type+'; charset=utf-8'}).end(await readFile(new URL('../web/'+file,import.meta.url)));
      }
      if(pages.has(path)&&response.ok)return res.writeHead(200).end(remotePage(await response.text()));
      res.writeHead(response.status);
      if(response.body)await pipeline(Readable.fromWeb(response.body),res);else res.end();
    }catch{
      if(!res.headersSent)reply(res,502,'O coletor local não respondeu. Tente novamente.');
      else res.destroy();
    }
  });
  server.maxConnections=32;
  return server;
}

if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
  const [host,login,port='8769']=process.argv.slice(2);
  if(!/^\d{4,5}$/.test(port)||Number(port)<1024||Number(port)>65535)throw Error('Porta local inválida.');
  createPrivatePanel({host,login}).listen(Number(port),'127.0.0.1',()=>console.log('Acesso privado pronto no loopback '+port+'.'));
}
