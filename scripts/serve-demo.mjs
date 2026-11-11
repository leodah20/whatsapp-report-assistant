import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {STATUSES,currentStage} from '../src/cases/stage.mjs';

const web=new URL('../web/',import.meta.url);
const month=new Intl.DateTimeFormat('sv-SE',{year:'numeric',month:'2-digit',timeZone:'America/Sao_Paulo'}).format(new Date());
const examples=[
  ['SDAI','Área técnica A','Verificação do detector de fumaça','Após a limpeza, o detector voltou a operar normalmente.'],
  ['CFTV','Acesso de serviço','Câmera sem comunicação','Aguardando a chegada do conector para concluir o reparo.'],
  ['SCA','Hall de visitantes','Ajuste do leitor de acesso','Atendimento em andamento.'],
  ['PABX','Recepção de exemplo','Interfone com ruído','Após a troca do cabo, o interfone voltou a operar normalmente.'],
  ['BMS','Sala de máquinas','Inspeção do painel de automação','Visita remarcada a pedido da equipe.']
];
const cases=examples.map(([area,location,title,text],i)=>{
  const serviceDay=month+'-01',referenceAt=Date.parse(serviceDay+'T14:00:00Z')/1000-i*60;
  const code='R-DE00000'+(i+1),sources=[{kind:'source',timestamp:referenceAt,text}];
  const stage=currentStage({},sources);
  return {code,area,location,title,serviceDay,referenceAt,summary:text,status:stage.status,stage,sourceCount:1,
    locationConfirmed:true,contextState:'complete',missing:[],openTasks:0,sources,notices:[],
    profile:{title,area,location,events:[],tasks:[]},
    facts:[{field:'ocorrencia',quote:title},{field:'resultado',quote:text}]};
});
const assets=new Map(Object.entries({
  '/cases.css':['cases.css','text/css'], '/closing.css':['closing.css','text/css'], '/cases.js':['cases.js','text/javascript'],
  '/api-explorer.css':['api-explorer.css','text/css'], '/api-explorer.js':['api-explorer.js','text/javascript']
}).map(([path,[file,type]])=>[path,[readFileSync(new URL(file,web)),type]]));
const dashboard=readFileSync(new URL('cases.html',web),'utf8')
  .replace('<body class="cases-page">','<body class="cases-page" data-demo="true">')
  .replace('href="/historico" id="history-link"','href="/historico" id="history-link" hidden')
  .replace('href="/fechamento" id="closing-link"','href="/fechamento" id="closing-link" hidden')
  .replace('<a href="/">Configuração</a>','<a href="/api-explorer">Explorador da API</a>')
  .replace('ACOMPANHAMENTO LOCAL','DEMONSTRAÇÃO')
  .replace('Dados neste computador','Dados fictícios')
  .replace('Acompanhe atendimentos e revise o que falta.','Explore a fila e o histórico. Todos os chamados são fictícios.')
  .replace('<details class="runtime-disclosure">','<details class="runtime-disclosure" hidden>');
const explorer=readFileSync(new URL('api-explorer.html',web),'utf8')
  .replace('<a href="/">Configuração</a>','')
  .replace('Local · somente leitura','Demonstração · somente leitura')
  .replace('A resposta pode conter informações internas. Não compartilhe sem revisar.','Esta demonstração responde apenas com dados fictícios.');
const runtime={connected:false,selected:false,supervised:false,analysisPending:0,demo:true};
const list=search=>({month:search.get('month')||month,statuses:STATUSES,unlinkedCount:0,items:
  search.get('month')===month?cases.map(({sources,notices,profile,facts,...row})=>row):[]});
const send=(res,status,type,body)=>res.writeHead(status,{'Content-Type':type+'; charset=utf-8'}).end(body);
const json=(res,status,body)=>send(res,status,'application/json',JSON.stringify(body));

export function createDemoServer(){
  return createServer({requestTimeout:15000,headersTimeout:10000,maxHeaderSize:8192},(req,res)=>{
    res.setHeader('Content-Security-Policy',"default-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Cache-Control','no-store');
    if(req.method!=='GET'){res.setHeader('Allow','GET');return json(res,405,{error:'Demonstração somente leitura.'});}
    const target=req.url||'';
    if(!target.startsWith('/')||target.startsWith('//')||target.length>512)return json(res,400,{error:'Rota inválida.'});
    const {pathname,searchParams}=new URL(target,'http://127.0.0.1');
    if(pathname==='/'||pathname==='/chamados')return send(res,200,'text/html',dashboard);
    if(pathname==='/api-explorer')return send(res,200,'text/html',explorer);
    if(pathname==='/api/cases')return json(res,200,list(searchParams));
    if(pathname==='/api/cases/runtime')return json(res,200,runtime);
    const item=cases.find(c=>pathname==='/api/cases/'+c.code);
    if(item)return json(res,200,item);
    const asset=assets.get(pathname);
    if(asset)return send(res,200,asset[1],asset[0]);
    return json(res,404,{error:'Rota não disponível na demonstração.'});
  });
}

if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
  createDemoServer().listen(8768,'127.0.0.1',()=>console.log('Demonstração: http://127.0.0.1:8768/'));
}
