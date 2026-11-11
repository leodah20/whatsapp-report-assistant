// Run with node scripts/ui-smoke.mjs and an installed Chrome/Chromium.
// This server uses synthetic data in memory and never connects to the collector.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import puppeteer from 'puppeteer';
import {CONFIG} from '../src/config.mjs';
import {STATUSES,currentStage} from '../src/cases/stage.mjs';

const month='2026-10', code='R-00000001', timestamp=1791890000;
const source={kind:'source',timestamp,text:'Foi relatada uma falha.',hasMedia:true,mediaState:'saved',mime:'image/png'};
const blocker='Aguardando a chegada da peça.';
const row={code,title:'Falha de leitura',area:'SCA',status:'pending',stage:currentStage({},[{timestamp,text:blocker}]),contextState:'missing',location:'Setor de testes',locationConfirmed:true,sourceCount:1,referenceAt:timestamp,missing:['resultado'],openTasks:0};
const profile={title:'Falha de leitura',location:row.location,events:[],tasks:[]};
const detail={...row,profile,sources:[source],notices:[],facts:[{field:'ocorrencia',quote:source.text}]};
const groups=[{name:'Controle de acesso',rows:[[1,'Verificação de teste','Operacional']]}];
const settings={issued:'2026-10-20',statuses:['done']};
const initialClosingItems=()=>[
  ...Array.from({length:15},(_,n)=>({...row,code:'R-'+(n+2).toString(16).padStart(8,'0').toUpperCase(),title:'Chamado de teste '+(n+2),state:'unreviewed',sourceReviewState:n===0?'stale':'unreviewed',stamp:'snapshot-'+(n+2)})),
  {...row,state:'unreviewed',sourceReviewState:'unreviewed',stamp:'snapshot-1'},
  {...row,code:'R-00000020',title:'Fonte já conferida',state:'unreviewed',sourceReviewState:'reviewed'}
];
const routes={
  '/':'setup.html','/ui.js':'setup.js','/style.css':'setup.css',
  '/chamados':'cases.html','/historico':'history.html','/fechamento':'closing.html','/minuta':'draft.html'
};
const types={html:'text/html',css:'text/css',js:'text/javascript'};
const data={
  '/api/cases':{month,statuses:STATUSES,unlinkedCount:3,items:[row,{...row,code:'R-00000002',status:'completed',stage:{status:'completed',origin:'manual'}}]},
  ['/api/cases/'+code]:detail,
  '/api/cases/runtime':{connected:true},
  '/api/cases/history':{count:1,sources:[{id:'synthetic-source',timestamp,text:'Legenda de teste',hasMedia:true,mediaState:'saved',mediaKind:'image'}]},
  '/api/cases/closing':{month,version:0,archiveCount:1,unlinkedCount:3,items:initialClosingItems(),checks:[],template:{groups,stamp:'template-test'},settings:{...settings}},
  '/api/cases/closing/draft':{month,groups,settings,items:[],name:'Edifício de teste',footer:'Equipe de teste'},
  '/api/status':{state:'desconectado',groups:[],count:0}
};
const assistantStatus=()=>({
  assistant:{enabled:true,busy:true,items:12,pending:0,confirmationsSent:5,confirmationsPending:2,newCallsConfirmed:4,error:'Resposta guardada; reanálise local pendente.'},
  recovery:{enabled:true,pending:0,scan:{phase:'done'}}
});
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aDncAAAAASUVORK5CYII=','base64');
const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1'),path=url.pathname;
  if(req.method==='POST'&&path==='/api/cases/closing/context'){
    res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({text:'Extração sintética com contexto',fingerprint:'test',attachments:0,pendingReview:1,unlinkedCount:2}));return;
  }
  if(req.method==='POST'&&path==='/api/cases/closing'){
    const chunks=[];for await(const chunk of req)chunks.push(chunk);
    const input=JSON.parse(Buffer.concat(chunks).toString());
    const current=data[path],item=current.items.find(x=>x.code===input.code);
    if(input.kind==='sources'&&item&&input.stamp===item.stamp){
      item.sourceReviewState='reviewed';item.sourceReview={attachments:input.attachments};
    }else if(input.kind==='preventives'&&input.templateStamp==='template-test'&&!Object.hasOwn(input,'issued')){
      current.settings.statuses=input.statuses;
    }else{res.writeHead(400).end('{}');return;}
    current.version++;
    res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify(current));return;
  }
  if(req.method!=='GET'){res.writeHead(405).end();return;}
  if(path==='/api/cases/history'&&url.searchParams.get('targets')==='1'){
    res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({targets:[{...row,current:true,month,status:'Aguardando'}]}));return;
  }
  if(path==='/api/cases/history/media'){res.writeHead(200,{'Content-Type':'image/png'}).end(png);return;}
  if(path==='/api/cases/'+code+'/attachment/0'||path==='/api/cases/'+code+'/media/0'){res.writeHead(200,{'Content-Type':'image/png'}).end(png);return;}
  if(data[path]){res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify(data[path]));return;}
  const match=path.match(/^\/api\/cases\/(R-[A-F0-9]{8})$/);
  const review=match&&data['/api/cases/closing'].items.find(x=>x.code===match[1]);
  if(review){res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({...detail,...review,sources:[]}));return;}
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
    Object.assign(data['/api/status'],assistantStatus());
    data['/api/cases/closing'].items=initialClosingItems();
    data['/api/cases/closing'].version=0;
    data['/api/cases/closing'].unlinkedCount=3;
    data['/api/cases/closing'].settings={...settings};
    await page.setViewport({width,height:850});
    const noOverflow=async()=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Página excede a largura: '+page.url());
    const verifySidebar=async()=>{
      assert.ok(await page.$eval('.panel-sidebar',side=>{
        const r=side.getBoundingClientRect(),main=document.querySelector('main').getBoundingClientRect();
        return innerWidth>860?getComputedStyle(side).position==='fixed'&&r.right<=main.left:r.bottom<=main.top;
      }));
      await noOverflow();
    };
    await open('/chamados','.detail-actions');await noOverflow();
    await page.waitForSelector('#history-dot:not([hidden])');
    assert.match(await page.$eval('#history-link',x=>x.title),/3 registros/);
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
    await goFromCases('#history-link','/historico','.source-record');await verifySidebar();
    assert.equal(await page.$eval('#history-unlinked-count',x=>x.textContent),'1');
    await page.click('#history-tools-link');
    assert.equal(await page.$eval('#history-tools',x=>x.open),true);
    assert.equal(await page.$eval('#assign-save',x=>x.disabled),true);
    assert.match(await page.$eval('.source-content',x=>x.textContent),/Legenda original.*Legenda de teste/);
    await page.click('.source-preview summary');
    await page.waitForFunction(()=>document.querySelector('.source-preview img')?.naturalWidth>0);
    assert.equal(await page.$eval('#selected-count',x=>x.textContent),'0 selecionadas');
    await page.click('.source-record input');
    assert.equal(await page.$eval('#selected-count',x=>x.textContent),'1 selecionada');
    assert.equal(await page.$eval('#create-case',x=>x.disabled),false);
    assert.equal(await page.$eval('#ignore-sources',x=>x.textContent),'Ignorar mensagem');
    assert.equal(await page.$eval('#assign-save',x=>x.disabled),true);
    await page.type('#target-search','setor');
    await page.waitForSelector('#target optgroup option');
    await page.select('#target',code);
    assert.equal(await page.$eval('#assign-save',x=>x.disabled),false);
    await page.click('#history-ignored');
    await page.waitForFunction(()=>document.querySelector('#ignore-sources').textContent==='Restaurar seleção');
    assert.equal(await page.$eval('#target-controls',x=>x.hidden),true);
    assert.equal(await page.$eval('#history-ignored',x=>x.getAttribute('aria-pressed')),'true');
    await page.waitForSelector('.source-record');
    await page.click('#history-unlinked');
    await page.waitForFunction(()=>document.querySelector('#history-unlinked').getAttribute('aria-pressed')==='true');
    await open('/chamados','.detail-actions');
    await goFromCases('#closing-link','/fechamento','.closing-list .case-card');await verifySidebar();
    await page.waitForSelector('#history-dot:not([hidden])');
    assert.match(await page.$eval('#history-pending-title',x=>x.textContent),/3 registros/);
    assert.equal(await page.$eval('#history-pending-link',x=>x.pathname+x.search),'/historico?month='+month);
    assert.equal(await page.$eval('#review-pending-count',x=>x.textContent),'16');
    assert.equal(await page.$eval('#review-done-count',x=>x.textContent),'1');
    await page.click('#extract-link');
    assert.equal(new URL(page.url()).hash,'#report-assist');
    assert.match(await page.$eval('#list .case-card',x=>x.textContent),/Fontes atualizadas/);
    assert.ok(await page.$eval('#list',x=>x.scrollHeight>x.clientHeight));
    const card='#list .case-card[data-code="'+code+'"]';
    await page.click(card);
    await page.waitForSelector('.review-attachment summary',{visible:true});
    assert.ok(await page.$eval('.review-editor-head',x=>{const r=x.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}));
    assert.ok(await page.$eval('#list',x=>x.scrollTop>0));
    await page.click('.review-attachment summary');
    await page.waitForFunction(()=>document.querySelector('.review-attachment img')?.naturalWidth>0);
    await page.click('.source-review > button');
    await page.waitForFunction(()=>document.querySelector('#review-done-count').textContent==='2');
    assert.equal(await page.$(card),null);
    const heading=title=>page.waitForFunction(title=>document.querySelector('.review-editor-head h2')?.textContent===title,{},title);
    await heading('Chamado de teste 2');
    for(let n=2;n<=16;n++){
      await heading('Chamado de teste '+n);
      await page.click('.source-review > button');
    }
    await heading('Todos os chamados conferidos');
    assert.equal(await page.$eval('#review-pending-count',x=>x.textContent),'0');
    assert.equal(await page.$eval('#assist-provider',x=>x.selectedOptions[0].textContent),'Exportar para outra IA');
    assert.equal(await page.$eval('#assist-open',x=>x.hidden),true);
    await clickText('.review-finished a','Conferir preventivas do mês');
    assert.equal(await page.$eval('#print-settings',x=>x.hidden),true);
    await page.click('.preventive-group summary');
    await page.select('select[name=preventive]','pending');
    await clickText('#settings-save','Salvar preventivas');
    await page.waitForFunction(()=>document.getElementById('notice').textContent.includes('Preventivas salvas'));
    await clickText('#editor #assist-run','Gerar extração');
    await page.waitForSelector('#editor #assist-output',{visible:true});
    assert.match(await page.$eval('#assist-history-text',x=>x.textContent),/2 registros/);
    await page.click('#review-done');
    assert.equal(await page.$eval('#review-done',x=>x.getAttribute('aria-pressed')),'true');
    assert.equal(await page.$$eval('#list .case-card',x=>x.length),17);
    await page.type('#review-search','FALHA');
    assert.equal(await page.$$eval('#list .case-card',x=>x.length),1);
    await page.click(card);
    await page.waitForFunction(()=>document.activeElement?.textContent==='Falha de leitura');
    assert.equal(await page.$eval('.final-review',x=>x.hidden),true);
    assert.equal(await page.$eval('#print-settings',x=>x.hidden),true);
    assert.equal(await page.$eval('#print-progress',x=>x.hidden),true);
    await page.select('#assist-provider','claude');
    await page.$eval('#assist-chat',x=>{x.value='';});
    await page.type('#assist-chat','https://claude.ai/chat/12345678-1234-1234-1234-123456789abc');
    assert.equal(await page.$eval('#assist-open',x=>x.href),'https://claude.ai/chat/12345678-1234-1234-1234-123456789abc');
    await page.click('#assist-run');
    await page.waitForSelector('#assist-output',{visible:true});
    assert.match(await page.$eval('#assist-text',x=>x.value),/contexto/);
    await noOverflow();
    await clickText('#print-mode','Fechar PDF pelo painel');
    await page.waitForSelector('.final-review select',{visible:true});
    await page.waitForSelector('#print-progress-link',{visible:true});
    assert.equal(await page.$eval('#extract-link',x=>x.hidden),true);
    assert.equal(await page.$eval('.final-review select',x=>x.value),'');
    const reasonVisible=()=>page.$eval('.final-review textarea[maxlength="1000"]',x=>!!x.getClientRects().length);
    assert.equal(await reasonVisible(),false);
    await page.select('.final-review select','defer');
    assert.equal(await reasonVisible(),true);
    if(!await page.$eval('.preventive-group',x=>x.open))await page.click('.preventive-group summary');
    await page.select('select[name=preventive]','pending');
    assert.match(await page.$eval('.preventive-group summary',x=>x.textContent),/1\/1 revisadas/);
    await clickText('#print-mode','Voltar para extração');
    await page.waitForSelector('#assist-output',{visible:true});
    assert.equal(await page.$eval('.final-review',x=>x.hidden),true);
    assert.equal(await page.$eval('#print-settings',x=>x.hidden),true);
    data['/api/cases/closing'].unlinkedCount=0;
    await open('/fechamento','.review-finished');
    assert.equal(await page.$eval('#history-dot',x=>x.hidden),true);
    assert.equal(await page.$eval('#history-pending',x=>x.hidden),true);
    await open('/minuta','.page.preventive table');await noOverflow();
    assert.equal(await page.$eval('#print',x=>x.disabled),false);
    await page.emulateMediaType('print');
    assert.equal(await page.$eval('.toolbar',x=>getComputedStyle(x).display),'none');
    await page.emulateMediaType('screen');
    await open('/chamados','.detail-actions');
    await goFromCases('a[href="/"]','/','.setup-grid',false);await verifySidebar();
    for(const anchor of ['connection','group','automatic','arquivo']){
      await page.click('.panel-sidebar a[href="#'+anchor+'"]');
      assert.equal(new URL(page.url()).hash,'#'+anchor);
      assert.ok(await page.$eval('#'+anchor,x=>{const r=x.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight;}));
    }
    await page.waitForFunction(()=>document.getElementById('status').textContent.includes('desconectado'));
    await page.waitForSelector('#assistant-metrics',{visible:true});
    assert.equal(await page.$eval('#assistant-status',x=>x.textContent),'Envios automáticos autorizados');
    assert.equal(await page.$eval('#assistant-activity',x=>x.textContent),'Análise em andamento');
    assert.equal(await page.$eval('#assistant-pending',x=>x.textContent),'0');
    assert.equal(await page.$eval('#assistant-confirmations-pending.attention',x=>x.textContent),'2');
    assert.equal(await page.$eval('#assistant-items',x=>x.textContent),'12');
    assert.equal(await page.$eval('#assistant-intakes',x=>x.textContent),'4');
    assert.equal(await page.$eval('#assistant-confirmations-sent',x=>x.textContent),'5');
    assert.match(await page.$eval('#assistant-recovery',x=>x.textContent),/Última busca concluída/);
    assert.match(await page.$eval('#assistant-notices li',x=>x.textContent),/reanálise local pendente/);
    Object.assign(data['/api/status'].assistant,{enabled:false,busy:false,confirmationsPending:0,error:null});
    data['/api/status'].recovery.enabled=false;
    await page.waitForFunction(()=>document.getElementById('assistant-status').textContent==='Envios automáticos pausados');
    assert.equal(await page.$eval('#assistant-notices',x=>x.hidden),true);
    assert.equal(await page.$eval('#assistant-recovery-row',x=>x.hidden),true);
    assert.equal(await page.$eval('#assistant-confirmations-pending',x=>x.classList.contains('attention')),false);
    await noOverflow();
    console.log(`Interface validada a ${width}px: chamados, histórico, fechamento, minuta e configuração.`);
  }
  assert.deepEqual(errors,[]);
}finally{
  await browser?.close();
  server.close();
}
