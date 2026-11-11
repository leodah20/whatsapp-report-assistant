// Run with node scripts/ui-smoke.mjs and an installed Chrome/Chromium.
// This server is read-only, uses synthetic data and never connects to the collector.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import puppeteer from 'puppeteer';
import {CONFIG} from '../src/config.mjs';
import {STATUSES,currentStage} from '../src/cases/stage.mjs';

const month='2026-10', code='R-00000001', timestamp=1791890000;
const source={kind:'source',timestamp,text:'Foi relatada uma falha.'};
const blocker='Aguardando a chegada da peça.';
const row={code,title:'Falha de leitura',area:'SCA',status:'pending',stage:currentStage({},[{timestamp,text:blocker}]),contextState:'missing',location:'Setor de testes',locationConfirmed:true,sourceCount:1,referenceAt:timestamp,missing:['resultado'],openTasks:0};
const profile={title:'Falha de leitura',location:row.location,events:[],tasks:[]};
const detail={...row,profile,sources:[source],notices:[],facts:[{field:'ocorrencia',quote:source.text}]};
const groups=[{name:'Controle de acesso',rows:[[1,'Verificação de teste','Operacional']]}];
const settings={issued:'2026-10-20',statuses:['done']};
const routes={
  '/':'setup.html','/ui.js':'setup.js','/style.css':'setup.css',
  '/chamados':'cases.html','/historico':'history.html','/fechamento':'closing.html','/minuta':'draft.html'
};
const types={html:'text/html',css:'text/css',js:'text/javascript'};
const data={
  '/api/cases':{month,statuses:STATUSES,items:[row,{...row,code:'R-00000002',status:'completed',stage:{status:'completed',origin:'manual'}}]},
  ['/api/cases/'+code]:detail,
  '/api/cases/runtime':{connected:true},
  '/api/cases/history':{count:1,sources:[{id:'synthetic-source',timestamp,text:'Fonte de teste'}]},
  '/api/cases/closing':{month,archiveCount:1,items:[{...row,state:'unreviewed'}],checks:[],template:{groups},settings},
  '/api/cases/closing/draft':{month,groups,settings,items:[],name:'Edifício de teste',footer:'Equipe de teste'},
  '/api/status':{state:'desconectado',groups:[],count:0}
};
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aDncAAAAASUVORK5CYII=','base64');
const server=createServer(async(req,res)=>{
  const path=new URL(req.url,'http://127.0.0.1').pathname;
  if(req.method!=='GET'){res.writeHead(405).end();return;}
  if(data[path]){res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify(data[path]));return;}
  if(path==='/api/cases/closing/cover'){res.writeHead(200,{'Content-Type':'image/png'}).end(png);return;}
  const file=routes[path]||(/^\/(cases|history|closing|draft)\.(js|css)$/.test(path)?path.slice(1):null);
  if(!file){res.writeHead(404).end();return;}
  try{
    const body=await readFile(new URL('../web/'+file,import.meta.url));
    res.writeHead(200,{'Content-Type':types[file.split('.').pop()]+'; charset=utf-8','Content-Security-Policy':"default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:"}).end(body);
  }catch{res.writeHead(500).end();}
});
assert.ok(CONFIG.chrome,'Chrome/Chromium não encontrado. Configure REPORT_CHROME_PATH.');
let browser;
try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  browser=await puppeteer.launch({executablePath:CONFIG.chrome,headless:true});
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const open=async(path,ready)=>{await page.goto(origin+path+'?month='+month);await page.waitForSelector(ready,{visible:true});};
  const clickText=async(selector,label)=>{await page.waitForSelector(selector,{visible:true});assert.equal(await page.$eval(selector,x=>x.textContent.trim()),label);await page.click(selector);};
  const goFromCases=async(selector,path,ready,withMonth=true)=>{
    await Promise.all([page.waitForNavigation(),page.click('.workspace-bar '+selector)]);
    const url=new URL(page.url());
    assert.equal(url.pathname,path);
    if(withMonth)assert.equal(url.searchParams.get('month'),month);
    await page.waitForSelector(ready,{visible:true});
  };
  for(const width of [1366,390]){
    await page.setViewport({width,height:850});
    const noOverflow=async()=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Página excede a largura: '+page.url());
    await open('/chamados','.detail-actions');await noOverflow();
    assert.deepEqual(await page.$$eval('.workspace-bar nav a',links=>links.map(a=>a.textContent.trim())),['Chamados','Histórico sem chamado','Fechamento mensal','Configuração']);
    assert.ok(await page.$eval('.workspace-bar',bar=>bar.getBoundingClientRect().bottom<document.querySelector('.page-head').getBoundingClientRect().top));
    assert.equal(await page.$eval('#month',x=>x.value),month);
    assert.equal(await page.$$eval('.stat strong',nodes=>Number(nodes[0].textContent)-nodes.slice(1).reduce((n,x)=>n+Number(x.textContent),0)),0);
    assert.match(await page.$eval('.stage-evidence',x=>x.textContent),/chegada da peça/);
    await page.click('#stats [data-stage=pending]');assert.equal(await page.$eval('#queue-count',x=>x.textContent),'1');
    assert.equal(await page.$$eval('.detail-actions > *',x=>x.length),2);
    await clickText('.detail-actions summary','Mais ações');
    await clickText('.detail-actions .action-option:nth-child(2)','Marcar como concluído');
    await page.waitForSelector('#edit-dialog[open]');
    await page.click('#cancel');await page.waitForSelector('#edit-dialog[open]',{hidden:true});
    await page.click('.tabs .tab:nth-child(4)');
    await page.waitForSelector('.context-form');
    await page.select('.stage-fields select','rescheduled');
    assert.equal(await page.$eval('.stage-fields textarea',x=>x.required),true);
    await page.waitForSelector('.stage-fields input[type=date]',{visible:true});
    assert.equal(await page.$$eval('.context-tip',x=>x.length),1);
    await page.focus('.context-form textarea[placeholder]');await page.keyboard.press('Tab');
    assert.equal(await page.$eval('.context-form textarea[placeholder]',x=>x.value),source.text);
    page.once('dialog',dialog=>dialog.accept());
    await page.click('.tabs .tab:nth-child(3)');
    await page.waitForSelector('.evidence-upload summary');
    await page.click('.evidence-upload summary');
    await page.waitForSelector('.evidence-upload input',{visible:true});await noOverflow();
    await goFromCases('#history-link','/historico','.source-record');await noOverflow();
    assert.equal(await page.$eval('#assign-save',x=>x.disabled),true);
    await page.click('.source-record input');
    assert.equal(await page.$eval('#selected-count',x=>x.textContent),'1 selecionada');
    assert.equal(await page.$eval('#assign-save',x=>x.disabled),false);
    await open('/chamados','.detail-actions');
    await goFromCases('#closing-link','/fechamento','.preventive-group summary');await noOverflow();
    await page.click('.preventive-group summary');
    await page.select('select[name=preventive]','pending');
    assert.match(await page.$eval('.preventive-group summary',x=>x.textContent),/1\/1 revisadas/);
    await open('/minuta','.page.preventive table');await noOverflow();
    assert.equal(await page.$eval('#print',x=>x.disabled),false);
    await page.emulateMediaType('print');
    assert.equal(await page.$eval('.toolbar',x=>getComputedStyle(x).display),'none');
    await page.emulateMediaType('screen');
    await open('/chamados','.detail-actions');
    await goFromCases('a[href="/"]','/','.setup-grid',false);await noOverflow();
    await page.waitForFunction(()=>document.getElementById('status').textContent.includes('desconectado'));
    console.log(`Interface validada a ${width}px: chamados, histórico, fechamento, minuta e configuração.`);
  }
  assert.deepEqual(errors,[]);
}finally{
  await browser?.close();
  server.close();
}
