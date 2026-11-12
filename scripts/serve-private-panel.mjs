import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {brandAssets} from '../src/brand-assets.mjs';
import {collaboratorData,collaboratorRoles,createAccessStore,validLogin} from './private-panel-access.mjs';

const pages=new Set(['/chamados','/historico','/fechamento','/minuta','/api-explorer']);
const staticRoutes=new Set(['/cases.js','/cases.css','/history.js','/closing.js','/closing.css','/draft.js','/draft.css','/api-explorer.js','/api-explorer.css',...Object.keys(brandAssets)]);
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
const collaboratorEdits=new Set(['profile','context','note','task','resolve']);
const collaboratorAssets=new Set(['/cases.js','/cases.css','/closing.css',...Object.keys(brandAssets)]);
const maxBody=24576;
const cookieName='__Host-remote_case';
const csp="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; media-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";
const reply=(res,status,error)=>res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'}).end(JSON.stringify({error}));
const json=(res,value)=>res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'}).end(JSON.stringify(value));
const pwaAssets=new Map([
  ['/app.webmanifest',['app.webmanifest','application/manifest+json']],
  ['/brand/app-192.png',['brand/app-192.png','image/png']],
  ['/brand/app-512.png',['brand/app-512.png','image/png']],
]);
const pwaTags='<link rel="manifest" href="/app.webmanifest"><meta name="theme-color" content="#101116"><link rel="apple-touch-icon" href="/brand/app-192.png">';

function remotePage(html,path,role){
  const page=html.replaceAll('href="/">Configuração','href="/configuracao">Configuração')
    .replace('<a href="/#arquivo">Importar mais registros</a>','<a href="/configuracao#arquivo">Importação no computador</a>')
    .replace('ACOMPANHAMENTO LOCAL','ACESSO PRIVADO')
    .replace('Dados neste computador','Dados no computador do coletor');
  if(path!=='/chamados')return page;
  return page.replace('</head>',pwaTags+'</head>').replace('<body ','<body data-access-role="'+role+'" ');
}
const settingsAssets=new Map([
  ['/configuracao',['private-settings.html','text/html']],
  ['/private-settings.js',['private-settings.js','text/javascript']]
]);

export function createPrivatePanel({host,login,collectorPort=8767,fetcher=fetch,access=null}){
  const authority=/^[a-z0-9-]{1,63}\.[a-z0-9-]{1,63}\.ts\.net(?::([1-9]\d{0,4}))?$/.exec(host||'');
  const httpsPort=Number(authority?.[1]||443);
  if(!authority||(authority[1]&&(httpsPort<1024||httpsPort>65535))||
     !validLogin(login)||
     !Number.isInteger(collectorPort)||collectorPort<1024||collectorPort>65535)throw Error('Configure hostname Tailscale, login exato e porta local válidos.');
  const origin='https://'+host,collector='http://127.0.0.1:'+collectorPort;
  const server=createServer({requestTimeout:15000,headersTimeout:10000,maxHeaderSize:8192},async(req,res)=>{
    res.setHeader('Content-Security-Policy',csp);
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    const identity=req.headers['tailscale-user-login'];
    if(req.socket.remoteAddress!=='127.0.0.1'||req.headers.host!==host||
       req.headers['x-forwarded-proto']!=='https'||!validLogin(identity)){
      return reply(res,403,'Acesso restrito à conta autorizada via Tailscale HTTPS.');
    }
    try{
      let role=identity===login?'admin':null;
      if(!role){
        try{role=access?.list().get(identity);}catch{/* A falha de leitura não libera acesso. */}
        if(!collaboratorRoles.has(role))return reply(res,403,'Acesso não liberado para esta conta Tailscale.');
      }
      const admin=role==='admin';
      const raw=req.url||'';
      if(!raw.startsWith('/')||raw.startsWith('//')||raw.length>2300||/[\\#]/.test(raw))return reply(res,400,'Endereço inválido.');
      const url=new URL(raw,origin),path=url.pathname;
      if(url.origin!==origin||path!==raw.split('?')[0])return reply(res,400,'Endereço inválido.');
      if(req.method==='GET'&&path==='/')return res.writeHead(302,{Location:'/chamados'}).end();
      if(req.method==='GET'&&(pwaAssets.has(path)||(admin&&path==='/private-settings.js'))){
        const [file,type]=pwaAssets.get(path)||settingsAssets.get(path);
        const content=await readFile(new URL('../web/'+file,import.meta.url));
        return res.writeHead(200,{'Content-Type':type}).end(content);
      }
      const headers={};
      const match=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1);
      if(/^[a-f0-9]{64}$/.test(match||''))headers.cookie='case_session='+match;
      if(path==='/api/panel/access'){
        if(!admin)return reply(res,403,'Somente o administrador gerencia acessos.');
        if(!access)return reply(res,503,'Gerenciamento de acessos indisponível.');
        if(req.method==='GET'){
          try{return json(res,[...access.list()].filter(([user])=>user!==login).map(([login,role])=>({login,role})));}
          catch{return reply(res,503,'Não foi possível consultar os acessos.');}
        }
        if(req.method!=='POST'||req.headers.origin!==origin||!headers.cookie||req.headers['content-type']!=='application/json')
          return reply(res,403,'Alteração de acesso não autorizada.');
        let size=0;const chunks=[];
        if(Number(req.headers['content-length'])>1024)return reply(res,413,'Atualização acima do limite.');
        for await(const chunk of req){
          size+=chunk.length;if(size>1024){req.resume();return reply(res,413,'Atualização acima do limite.');}
          chunks.push(chunk);
        }
        let input;
        try{input=JSON.parse(Buffer.concat(chunks).toString());}catch{return reply(res,400,'Atualização inválida.');}
        if(!validLogin(input?.login)||input.login.toLowerCase()===login.toLowerCase()||
           !(input.role===null||collaboratorRoles.has(input.role))||Object.keys(input).length!==2)
          return reply(res,400,'Informe um login de colaborador válido e selecione a permissão.');
        try{
          if(!access.change(input.login,input.role))return reply(res,409,'Limite de colaboradores atingido.');
          return json(res,{ok:true});
        }catch{return reply(res,503,'Não foi possível salvar a permissão.');}
      }
      const settings=req.method==='GET'&&path==='/configuracao';
      const read=req.method==='GET'&&(admin?(settings||pages.has(path)||staticRoutes.has(path)||readApis.has(path)||caseRoute.test(path)||mediaRoute.test(path)):
        (path==='/chamados'||collaboratorAssets.has(path)||path==='/api/cases'||caseRoute.test(path)));
      const photo=req.method==='POST'&&photoRoute.test(path);
      const write=req.method==='POST'&&(admin?(caseRoute.test(path)||writes.has(path)||photo):role==='editor'&&caseRoute.test(path));
      if(!admin&&!read&&!write)return reply(res,403,'Seu perfil não permite esta operação.');
      if(!read&&!write)return reply(res,404,'Rota não disponível no acesso remoto.');
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
          const allowed=caseRoute.test(path)?(admin?edits:collaboratorEdits):writes.get(path);
          if(!input||Array.isArray(input)||typeof input!=='object'||(allowed&&!allowed.has(input.kind)))return reply(res,403,'Operação não autorizada para esta rota.');
        }
        headers.origin=collector;
        headers['content-type']=type;
      }
      const timeout=path==='/api/cases/closing/local'?920000:path==='/api/cases/closing/package'||headers.range?120000:30000;
      if(!admin){
        // Recheck after reading a request body, in case access changed mid-request.
        const latest=access.list().get(identity);
        if(!collaboratorRoles.has(latest)||(write&&latest!=='editor'))return reply(res,403,'A permissão para este acesso mudou.');
      }
      const response=await fetcher(collector+(settings?'/chamados':path)+url.search,{method:req.method,headers,body,redirect:'error',signal:AbortSignal.timeout(timeout)});
      if(!admin&&(path==='/api/cases'||caseRoute.test(path))){
        if(response.ok)return json(res,{...collaboratorData(path,await response.json()),accessRole:role});
        if(response.status===401)return reply(res,401,'Reabra o painel para renovar a sessão.');
        if(response.status===409)return reply(res,409,'O chamado mudou. Recarregue antes de salvar.');
        if(response.status===404)return reply(res,404,'Chamado não encontrado.');
        return reply(res,response.status>=500?502:400,'Não foi possível consultar ou atualizar o chamado.');
      }
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
      if(pages.has(path)&&response.ok)return res.writeHead(200).end(remotePage(await response.text(),path,role));
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
  const access=createAccessStore(fileURLToPath(new URL('../.remote-panel-access.local.json',import.meta.url)));
  createPrivatePanel({host,login,access}).listen(Number(port),'127.0.0.1',()=>console.log('Acesso privado pronto no loopback '+port+'.'));
}
