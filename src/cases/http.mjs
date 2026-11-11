import {randomBytes} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {CaseError,imageType} from './board.mjs';

const assets={'/chamados':['web/cases.html','text/html'],'/cases.js':['web/cases.js','text/javascript'],'/cases.css':['web/cases.css','text/css'],'/fechamento':['web/closing.html','text/html'],'/minuta':['web/draft.html','text/html'],'/historico':['web/history.html','text/html'],'/history.js':['web/history.js','text/javascript'],'/closing.js':['web/closing.js','text/javascript'],'/closing.css':['web/closing.css','text/css'],'/draft.js':['web/draft.js','text/javascript'],'/draft.css':['web/draft.css','text/css']};
const age=12*60*60;
const json=(res,value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));};
async function bytes(req,limit){
  const chunks=[];let size=0;
  if(Number(req.headers['content-length'])>limit)throw new CaseError('Atualização acima do limite.',413);
  for await(const chunk of req){size+=chunk.length;if(size>limit)throw new CaseError('Atualização acima do limite.',413);chunks.push(chunk);}
  return Buffer.concat(chunks);
}
async function body(req,limit=8192){
  const data=await bytes(req,limit);
  try{return JSON.parse(data.toString('utf8'));}catch{throw new CaseError('Atualização inválida.');}
}

export function createCaseHandler({origin,root,board,readMedia,closing,historical,readCover,getRuntime=()=>null}){
  const host=new URL(origin).host,sessions=new Map();
  return async function handle(req,res,url){
    const asset=Object.hasOwn(assets,url.pathname)?assets[url.pathname]:null;
    if(!asset&&url.pathname!=='/api/cases'&&!url.pathname.startsWith('/api/cases/'))return false;
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    if(req.headers.host!==host){json(res,{error:'Endereço local inválido.'},403);return true;}
    const token=(req.headers.cookie||'').split(';').map(c=>c.trim()).find(c=>c.startsWith('case_session='))?.slice(13);
    const authorized=(sessions.get(token)||0)>Date.now();
    try{
      if(asset&&req.method==='GET'){
        if(['/chamados','/fechamento','/minuta','/historico'].includes(url.pathname)&&!authorized){
          const newToken=randomBytes(32).toString('hex');sessions.set(newToken,Date.now()+age*1000);
          while(sessions.size>40)sessions.delete(sessions.keys().next().value);
          res.setHeader('Set-Cookie',`case_session=${newToken}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}`);
        }
        res.writeHead(200,{'Content-Type':asset[1]+'; charset=utf-8'});res.end(readFileSync(join(root,asset[0])));return true;
      }
      if(!authorized){json(res,{error:'Reabra o painel para renovar a sessão local.'},401);return true;}
      if(url.pathname==='/api/cases/history'){
        if(!historical)throw new CaseError('Histórico indisponível.',404);
        const month=url.searchParams.get('month');
        if(req.method==='GET'){json(res,historical.view(month,Number(url.searchParams.get('offset')||0)));return true;}
        if(req.method==='POST'&&req.headers.origin===origin&&req.headers['content-type']==='application/json'){
          if(Number(req.headers['content-length'])>8192)throw new CaseError('Atualização acima do limite.',413);
          const data=await body(req);
          if(data?.kind==='prepare'){json(res,historical.prepare(month,data.before??null),202);return true;}
          if(data?.kind==='assign'){json(res,{code:historical.assign(month,data.ids,data.code)});return true;}
          if(data?.kind==='recheck'){json(res,historical.recheck(month),202);return true;}
        }
        throw new CaseError('Operação local não autorizada.',403);
      }
      if(url.pathname.startsWith('/api/cases/closing')){
        if(!closing)throw new CaseError('Fechamento indisponível.',404);
        const month=url.searchParams.get('month');
        if(req.method==='GET'&&url.pathname==='/api/cases/closing'){json(res,closing.get(month));return true;}
        if(req.method==='GET'&&url.pathname==='/api/cases/closing/draft'){json(res,closing.draft(month));return true;}
        if(req.method==='GET'&&url.pathname==='/api/cases/closing/cover'){
          closing.draft(month);
          const bytes=readCover();
          if(!imageType(bytes,'image/png'))throw new CaseError('Capa local indisponível.',404);
          res.writeHead(200,{'Content-Type':'image/png'});res.end(bytes);return true;
        }
        if(req.method==='POST'&&url.pathname==='/api/cases/closing'&&req.headers.origin===origin&&req.headers['content-type']==='application/json'){
          if(Number(req.headers['content-length'])>8192)throw new CaseError('Atualização acima do limite.',413);
          json(res,closing.save(month,await body(req)));return true;
        }
        throw new CaseError('Operação local não autorizada.',403);
      }
      if(req.method==='GET'&&url.pathname==='/api/cases/runtime'){json(res,getRuntime());return true;}
      if(req.method==='GET'&&url.pathname==='/api/cases'){
        json(res,board.list(url.searchParams.get('month'),url.searchParams.get('carry')==='1',url.searchParams.get('archived')==='1'));return true;
      }
      const upload=url.pathname.match(/^\/api\/cases\/(R-[A-F0-9]{8})\/photo$/);
      if(upload&&req.method==='POST'&&req.headers.origin===origin&&['image/jpeg','image/png','image/webp'].includes(req.headers['content-type'])){
        json(res,board.addPhoto(upload[1],await bytes(req,5*1024*1024),req.headers['content-type']));return true;
      }
      const path=url.pathname.match(/^\/api\/cases\/(R-[A-F0-9]{8})(?:\/media\/(\d{1,4}))?$/);
      if(!path)throw new CaseError('Rota de chamados não encontrada.',404);
      if(req.method==='GET'&&path[2]===undefined){json(res,board.detail(path[1]));return true;}
      if(req.method==='GET'&&path[2]!==undefined){
        const source=board.sources(board.item(path[1]))[Number(path[2])];
        if(!source||source.mediaState!=='saved')throw new CaseError('Imagem não disponível.',404);
        const bytes=readMedia(source.id);
        const mime=bytes&&imageType(bytes,source.mime?.split(';')[0]);
        if(!mime)throw new CaseError('Imagem indisponível ou fora dos tipos/limite de visualização.',404);
        res.writeHead(200,{'Content-Type':mime,'Content-Length':bytes.length});res.end(bytes);return true;
      }
      if(req.method!=='POST'||path[2]!==undefined||req.headers.origin!==origin||req.headers['content-type']!=='application/json'){
        json(res,{error:'Operação local não autorizada.'},403);return true;
      }
      json(res,board.change(path[1],await body(req,24576)));return true;
    }catch(e){if(!res.headersSent)json(res,{error:e instanceof CaseError?e.message:'Não foi possível consultar ou guardar este chamado.'},e instanceof CaseError?e.status:500);else res.end();return true;}
  };
}
