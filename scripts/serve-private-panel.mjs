import {createServer} from 'node:http';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {pathToFileURL} from 'node:url';

const staticRoutes=new Set(['/chamados','/cases.js','/cases.css','/closing.css']);
const caseRoute=/^\/api\/cases\/R-[A-F0-9]{8}$/;
const imageRoute=/^\/api\/cases\/R-[A-F0-9]{8}\/media\/\d{1,4}$/;
const edits=new Set(['profile','context','note','task','resolve']);
const maxBody=24576;
const cookieName='__Host-remote_case';
const csp="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";
const reply=(res,status,error)=>res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'}).end(JSON.stringify({error}));

function remoteDashboard(html){
  return html.replace('<body class="cases-page">','<body class="cases-page" data-remote="true">')
    .replace('href="/historico" id="history-link"','href="/historico" id="history-link" hidden')
    .replace('href="/fechamento" id="closing-link"','href="/fechamento" id="closing-link" hidden')
    .replace('<a href="/">Configuração</a>','')
    .replace('ACOMPANHAMENTO LOCAL','ACESSO PRIVADO')
    .replace('Dados neste computador','Dados no computador do coletor');
}

export function createPrivatePanel({host,login,collectorPort=8767,fetcher=fetch}){
  if(!/^[a-z0-9-]{1,63}\.[a-z0-9-]{1,63}\.ts\.net$/.test(host||'')||
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
      if(!raw.startsWith('/')||raw.startsWith('//')||raw.length>512||/[\\#]/.test(raw))return reply(res,400,'Endereço inválido.');
      const url=new URL(raw,origin),path=url.pathname;
      if(url.origin!==origin||path!==raw.split('?')[0])return reply(res,400,'Endereço inválido.');
      if(req.method==='GET'&&path==='/')return res.writeHead(302,{Location:'/chamados'}).end();
      const read=req.method==='GET'&&(staticRoutes.has(path)||path==='/api/cases'||path==='/api/cases/runtime'||caseRoute.test(path)||imageRoute.test(path));
      const write=req.method==='POST'&&caseRoute.test(path);
      if(!read&&!write)return reply(res,404,'Rota não disponível no acesso remoto.');
      const headers={};
      const match=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1);
      if(/^[a-f0-9]{64}$/.test(match||''))headers.cookie='case_session='+match;
      let body;
      if(write){
        if(req.headers.origin!==origin||req.headers['content-type']!=='application/json'||!headers.cookie)return reply(res,403,'Edição não autorizada.');
        if(Number(req.headers['content-length'])>maxBody)return reply(res,413,'Atualização acima do limite.');
        const chunks=[];let length=0;
        for await(const chunk of req){
          length+=chunk.length;if(length>maxBody){req.resume();return reply(res,413,'Atualização acima do limite.');}chunks.push(chunk);
        }
        let input;
        try{input=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return reply(res,400,'Atualização inválida.');}
        if(!input||!edits.has(input.kind))return reply(res,403,'Essa alteração só pode ser feita no painel local.');
        headers.origin=collector;
        headers['content-type']='application/json';
        body=JSON.stringify(input);
      }
      const response=await fetcher(collector+path+url.search,{method:req.method,headers,body,redirect:'error',signal:AbortSignal.timeout(15000)});
      const type=response.headers.get('content-type');
      if(type)res.setHeader('Content-Type',type);
      const token=response.headers.get('set-cookie')?.match(/^case_session=([a-f0-9]{64});/)?.[1];
      if(path==='/chamados'&&token)res.setHeader('Set-Cookie',cookieName+'='+token+'; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200');
      if(path==='/chamados'&&response.ok)return res.writeHead(200).end(remoteDashboard(await response.text()));
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
  const [host,login]=process.argv.slice(2);
  createPrivatePanel({host,login}).listen(8769,'127.0.0.1',()=>console.log('Acesso privado pronto no loopback 8769.'));
}
