import http from 'node:http';
import { randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import QRCode from 'qrcode';
import pkg from 'whatsapp-web.js';
import { seal, open, inScope, recordOf } from './core.mjs';
import { installIdCompatibility, groupChoices } from './whatsapp/compat.mjs';
import { collectMonth } from './whatsapp/history.mjs';
import { downloadGroupMedia } from './whatsapp/media.mjs';
import { ReportAssistant, PREFIX } from './assistant/assistant.mjs';
import { receiptText } from './assistant/receipts.mjs';
import { RecoveryQueue, recoveryMonths } from './whatsapp/recovery.mjs';
import { intakeText } from './assistant/intake.mjs';
import { verifyTransport, brokenTransport, closeOwnedClient } from './whatsapp/transport.mjs';
import { CONFIG } from './config.mjs';
import { CaseBoard } from './cases/board.mjs';
import { createCaseHandler } from './cases/http.mjs';
import { MonthlyClosing } from './cases/closing.mjs';
import { HistoricalCases } from './cases/history.mjs';
const {Client,LocalAuth,Message}=pkg;
const ROOT=CONFIG.root;
const PY=CONFIG.python;
const PORT=CONFIG.port, ORIGIN=`http://127.0.0.1:${PORT}`;
const KEY=Buffer.from(execFileSync(PY,[join(ROOT,'integrations/mcp/vault.py'),'--init'],{windowsHide:true,encoding:'utf8'}).trim(),'base64');
const DATA=CONFIG.dataDir; mkdirSync(DATA,{recursive:true});
const db=new DatabaseSync(join(DATA,'archive.sqlite'));
db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, month TEXT NOT NULL, ts INTEGER NOT NULL, payload BLOB NOT NULL, media BLOB); CREATE INDEX IF NOT EXISTS month_ts ON messages(month,ts);');
const CFG=join(DATA,'scope.enc');
let scope={groupId:null,groupName:null,paused:true};
if(existsSync(CFG)) scope=JSON.parse(open(KEY,readFileSync(CFG),'scope'));
if(process.argv.includes('--enable-authorized-questions')){scope.questionsEnabled=true;scope.questionsAuthorizedAt=new Date().toISOString();}
let state='desconectado',qr=null,client=null,error=null,diagnostic=null,queue=Promise.resolve(),stored=0,importJob=null,recovering=false,stopping=false,reauthRequired=!!scope.linkRequired,nextReconnect=0,connecting=false,checkingTransport=false,lastTransportCheck=null;
let startedAt=new Date().toISOString();
const sessions=new Set(); let choices=[];
function persist(){writeFileSync(CFG,seal(KEY,Buffer.from(JSON.stringify(scope)),'scope'));}
function requireLink(){reauthRequired=true;if(scope.groupId&&!scope.linkRequired){scope.linkRequired=true;persist();}}
function readSource(id){const row=db.prepare('SELECT payload FROM messages WHERE id=?').get(id);return row?JSON.parse(open(KEY,row.payload,id)):null;}
const assistant=new ReportAssistant({db,key:KEY,readSource,isArchived:id=>!!caseBoard.profile(id).archived,isActive:()=>!stopping&&state==='conectado'&&!scope.paused&&!!scope.groupId&&!!scope.questionsEnabled,enabled:!!scope.questionsEnabled,send:async(text,quotedMessageId,options={})=>{
  if(stopping||state!=='conectado'||scope.paused||!scope.questionsEnabled||!scope.groupId?.endsWith('@g.us')||text.length>1200)throw Error('Mensagem fora do escopo autorizado');
  if(options.kind==='intake'){
    const item=assistant.all().find(i=>i.id===options.itemId);
    if(!item||item.intakeState!=='sending'||!item.sourceIds.includes(quotedMessageId)||intakeText(item)!==text)throw Error('Confirmação de registro não autorizada');
  }else if(options.kind==='receipt'){
    const receipt=assistant.receipts.get(quotedMessageId);
    if(!receipt||receipt.state!=='sending'||receipt.itemId!==options.itemId||receipt.code!==options.code||receiptText(receipt.code,receipt.outcome)!==text)throw Error('Confirmação não autorizada');
  }else if(options.kind!==undefined||!text.startsWith(PREFIX+' [R-')||!text.includes('\nSobre '))throw Error('Envio fora do escopo autorizado');
  const result=await client.sendMessage(scope.groupId,text,{quotedMessageId,ignoreQuoteErrors:false,sendSeen:false,linkPreview:false,parseVCards:false,waitUntilMsgSent:true});
  const id=result?.id?._serialized||result?.id?.['$1'];if(!id)throw Error('Envio sem identificador confirmado');return id;
}});
const caseBoard=new CaseBoard({db,key:KEY,assistant,readSource});
const coverPath=join(DATA,'report-cover.png');
const closing=new MonthlyClosing({db,key:KEY,board:caseBoard,template(){
  try{
    const path=join(DATA,'report-template.json');
    if(statSync(path).size>32768||statSync(coverPath).size>8*1024*1024)return null;
    const t=JSON.parse(readFileSync(path,'utf8').replace(/^\uFEFF/,''));
    const str=(v,n)=>typeof v==='string'&&v.length<=n;
    if(!str(t.name,100)||!t.name.trim()||!str(t.footer,250)||!Array.isArray(t.groups)||t.groups.length!==6||!t.groups.every(g=>str(g.name,70)&&Array.isArray(g.rows)&&g.rows.length>0&&g.rows.length<=20&&g.rows.every(row=>Array.isArray(row)&&row.length===3&&str(row[0],12)&&str(row[1],400)&&str(row[2],25))))return null;
    return {name:t.name,footer:t.footer,groups:t.groups};
  }catch{return null;}
},archive(month){
  const hash=createHash('sha256');let count=0;
  for(const row of db.prepare("SELECT id,payload FROM messages WHERE month=? AND id NOT LIKE 'manual-photo:%' ORDER BY id").iterate(month)){hash.update(row.id);hash.update(row.payload);count++;}
  return {count,revision:hash.digest('hex')};
}});
const historical=new HistoricalCases({db,board:caseBoard,assistant,readSource});
const serveCases=createCaseHandler({origin:ORIGIN,root:ROOT,board:caseBoard,closing,historical,readCover:()=>readFileSync(coverPath),getRuntime:runtimePulse,readMedia(id){
  const size=db.prepare('SELECT length(media) AS n FROM messages WHERE id=?').get(id)?.n;
  if(!size||size>8*1024*1024+28)return null;
  const {media}=db.prepare('SELECT media FROM messages WHERE id=?').get(id);
  return open(KEY,media,id+':media');
}});
const recovery=new RecoveryQueue({db,key:KEY,readSource,deliver:r=>assistant.accept(r),enable:process.argv.includes('--enable-recovery'),isActive:()=>!stopping&&state==='conectado'&&!scope.paused&&!!scope.questionsEnabled});
recovery.restore();
if(process.argv.includes('--enable-authorized-questions'))persist();
function runtimePulse(){
  let supervised=false;
  try{supervised=Date.now()-statSync(join(DATA,'watchdog.json')).mtimeMs<90000;}catch{}
  return {state,connected:state==='conectado'&&!!lastTransportCheck&&Date.now()-Date.parse(lastTransportCheck)<120000,paused:scope.paused,selected:!!scope.groupId,requiresLink:reauthRequired||!!qr,lastTransportCheck,lastSyncAt:recovery.status().lastSyncAt,recovering,supervised,analysisPending:assistant.status().pending,error:error||recovery.lastError||assistant.lastError};
}
function health(){return {state,lastTransportCheck,groupName:scope.groupName,selected:!!scope.groupId,paused:scope.paused,requiresLink:reauthRequired||!!qr,count:db.prepare('SELECT COUNT(*) AS n FROM messages').get().n,storedThisSession:stored,error,diagnostic,importJob,assistant:assistant.status(),recovery:recovery.status(),startedAt,hasQr:!!qr};}
function errorSummary(e){return {name:String(e?.name||'Error').slice(0,80),message:String(e?.message||'Falha desconhecida').replace(/https?:\/\/\S+/g,'[URL]').replace(/\b\d{10,}\b/g,'[identificador]').replace(/[a-f0-9]{32,}/gi,'[identificador]').slice(0,500)};}
function statusFile(){writeFileSync(join(DATA,'status.json'),JSON.stringify(health()));}
statusFile(); setInterval(statusFile,15000).unref();
async function checkTransport(){
  if(checkingTransport||connecting||stopping||state!=='conectado')return;checkingTransport=true;const inspected=client;
  try{await verifyTransport(inspected);lastTransportCheck=new Date().toISOString();}
  catch(e){if(client===inspected&&!stopping){state='erro';if(e.reauthRequired)requireLink();error=reauthRequired?'É necessário vincular o WhatsApp novamente.':'A sessão do WhatsApp perdeu a conexão; reconectando.';diagnostic={step:'transport-watchdog',...errorSummary(e)};nextReconnect=0;statusFile();if(!reauthRequired&&!scope.paused)void connect();}}
  finally{checkingTransport=false;}
}
setInterval(()=>void checkTransport(),30000).unref();
setInterval(()=>{void recovery.drain();void assistant.flush();if(recovery.meta.enabled&&Date.now()-nextReconnect>=300000)void recoverAutomatic();if(!stopping&&!reauthRequired&&!qr&&!scope.paused&&scope.groupId&&['erro','desconectado'].includes(state)&&Date.now()>=nextReconnect){nextReconnect=Date.now()+60000;void connect();}},60000).unref();
async function capture(m,override=false){
  if(stopping||!inScope(m,scope.groupId,scope.paused) || (!override&&!recovery.meta.enabled&&m.timestamp < Date.parse(startedAt)/1000-60))return;
  let r=recordOf(m);
  const existing=db.prepare('SELECT payload FROM messages WHERE id=?').get(r.id);
  if(existing){const previous=JSON.parse(open(KEY,existing.payload,r.id));const retryMedia=override&&r.hasMedia&&previous.mediaState!=='saved';const retryQuote=override&&m.hasQuotedMsg&&!previous.quotedId;if(!retryMedia&&!retryQuote)return;r={...r,...previous};}
  let media=null;
  // Persist the text first so a failed media download never loses the event.
  if(!existing){db.prepare('INSERT INTO messages VALUES(?,?,?,?,?)').run(r.id,r.month,r.timestamp,seal(KEY,Buffer.from(JSON.stringify(r)),r.id),null);stored++;}statusFile();
  if(m.hasMedia&&r.mediaState!=='saved'){
    try{
      if(Number(m._data?.size||0)>100*1024*1024){r.mediaState='too-large';}
      else{
        const attachment=await downloadGroupMedia(client,scope.groupId,r.id);
        if(!attachment?.data) r.mediaState='unavailable';
        else if(attachment.data.length>140*1024*1024)r.mediaState='too-large';
        else{
          media=seal(KEY,Buffer.from(attachment.data,'base64'),r.id+':media');
          r.mediaState='saved';r.mime=attachment.mimetype;r.filename=String(attachment.filename||'').slice(0,200);
        }
      }
    }catch(e){r.mediaState='failed';r.mediaError=errorSummary(e);}
    db.prepare('UPDATE messages SET payload=?,media=? WHERE id=?').run(seal(KEY,Buffer.from(JSON.stringify(r)),r.id),media,r.id);
  }
  if(m.hasQuotedMsg){try{const quoted=await m.getQuotedMessage(); if(inScope(quoted,scope.groupId,false))r.quotedId=quoted.id._serialized;}catch{}}
  db.prepare('UPDATE messages SET payload=? WHERE id=?').run(seal(KEY,Buffer.from(JSON.stringify(r)),r.id),r.id);
  if(!override){if(recovery.meta.enabled){recovery.offer(r);void recovery.drain();}else await assistant.accept(r);}
}
function enqueue(m,override=false){const operation=queue.then(()=>capture(m,override));queue=operation.catch(()=>{error='Falha ao guardar uma mensagem; confira o painel.';statusFile();});return operation;}
async function recoverAutomatic(){
  if(recovering||stopping||!recovery.meta.enabled||state!=='conectado'||scope.paused||!scope.groupId)return;
  if(importJob&&!['done','error'].includes(importJob.phase))return;
  recovering=true;const inspected=client;const window=recovery.window();recovery.scan={phase:'loading',from:window.from,to:window.to};statusFile();
  try{
    let recovered=0;
    for(const month of recoveryMonths(window.from,window.to)){
      if(scope.paused||state!=='conectado')throw Error('Retomada interrompida');
      const result=await collectMonth(client,scope.groupId,month,info=>{recovery.scan={...recovery.scan,...info,month};statusFile();});
      if(result.errors||(!result.coverage.boundaryReached&&!result.coverage.historyExhausted))throw Error('Histórico sem cobertura confirmada');
      for(const data of result.data){if(Number(data.t)<window.from||Number(data.t)>window.to)continue;await enqueue(new Message(client,data),true);const record=readSource(data.id?._serialized);if(record&&recovery.offer(record))recovered++;}
    }
    recovery.restore();recovery.completeScan(window.to);recovery.scan={...recovery.scan,phase:'done',queued:recovered};recovery.lastError=null;if(diagnostic?.step==='recovery')diagnostic=null;
    void recovery.drain();await assistant.reconcileAnswers();assistant.schedule();
  }catch(e){recovery.scan={...recovery.scan,phase:'error'};recovery.lastError='Retomada pendente; será tentada novamente automaticamente.';diagnostic={step:'recovery',...errorSummary(e)};if(client===inspected&&brokenTransport(e)&&!stopping){state='erro';error='A sessão do WhatsApp precisa reconectar; fontes preservadas.';}}
  finally{recovering=false;nextReconnect=Date.now();statusFile();}
}
async function importMonth(month){
  if(importJob&&!['done','error'].includes(importJob.phase))return;
  importJob={month,phase:'loading',startedAt:new Date().toISOString()};statusFile();
  try{
    if(!scope.groupId||scope.paused||state!=='conectado')throw Error('Grupo precisa estar ativo');
    const result=await collectMonth(client,scope.groupId,month,info=>{importJob={...importJob,...info};statusFile();});
    importJob={...importJob,phase:'saving',found:result.found,serializationErrors:result.errors,coverage:result.coverage,processed:0};statusFile();
    for(const data of result.data){await enqueue(new Message(client,data),true);importJob.processed++;statusFile();}
    const rows=db.prepare('SELECT id,payload FROM messages WHERE month=? ORDER BY ts').all(month);
    const records=rows.map(row=>JSON.parse(open(KEY,row.payload,row.id)));
    const mediaStates={};const types={};
    for(const r of records){mediaStates[r.mediaState]=(mediaStates[r.mediaState]||0)+1;types[r.type]=(types[r.type]||0)+1;}
    importJob={...importJob,phase:'done',finishedAt:new Date().toISOString(),archived:records.length,mediaStates,types,first:records[0]?.timestamp,last:records.at(-1)?.timestamp};statusFile();
    writeFileSync(join(DATA,`import-${month}.json`),JSON.stringify(importJob,null,2));
  }catch(e){importJob={...importJob,phase:'error',diagnostic:errorSummary(e)};statusFile();}
}
async function connect(){
  if(connecting||stopping)return;
  if(client && !['desconectado','erro','falha-autenticacao'].includes(state))return;
  connecting=true;
  const previous=client;client=null;
  state='iniciando';lastTransportCheck=null;error=null;diagnostic=null;statusFile();
  await closeOwnedClient(previous);
  if(!CONFIG.chrome){connecting=false;state='erro';error='Navegador não encontrado. Configure REPORT_CHROME_PATH para Chrome ou Chromium instalado.';statusFile();return;}
  client=new Client({authStrategy:new LocalAuth({clientId:CONFIG.sessionId,dataPath:join(DATA,'session')}),deviceName:'Report Assistant Local',takeoverOnConflict:false,webVersionCache:{type:'none'},puppeteer:{headless:true,executablePath:CONFIG.chrome,args:['--disable-notifications']}});
  const boundClient=client;
  // Only identified context questions and persisted-answer receipts, in the fixed group.
  client.on('qr',async value=>{if(client!==boundClient||stopping)return;qr=await QRCode.toDataURL(value);requireLink();state='aguardando-qr';statusFile();});
  client.on('authenticated',()=>{if(client!==boundClient||stopping)return;qr=null;state='autenticando';statusFile();});
  client.on('auth_failure',()=>{if(client!==boundClient||stopping)return;requireLink();qr=null;state='falha-autenticacao';error='A vinculação foi recusada. Não houve captura.';statusFile();});
  client.on('disconnected',reason=>{if(client!==boundClient||stopping)return;if(/LOGOUT|UNPAIRED|AUTH/i.test(String(reason)))requireLink();qr=null;state='desconectado';error='WhatsApp desconectado; captura interrompida.';statusFile();});
  client.on('message_create',m=>{if(client===boundClient&&inScope(m,scope.groupId,scope.paused))void enqueue(m).catch(()=>{});});
  client.on('message_edit',(m)=>{if(!inScope(m,scope.groupId,scope.paused))return;queue=queue.then(()=>{const row=db.prepare('SELECT payload FROM messages WHERE id=?').get(m.id._serialized);if(!row)return;const r=JSON.parse(open(KEY,row.payload,m.id._serialized));r.previousText=r.text;r.text=String(m.body||'').slice(0,30000);r.editedAt=new Date().toISOString();db.prepare('UPDATE messages SET payload=? WHERE id=?').run(seal(KEY,Buffer.from(JSON.stringify(r)),r.id),r.id);}).catch(()=>{});});
  client.on('ready',async()=>{
    if(client!==boundClient||stopping)return;
    state='verificando';qr=null;statusFile();
    let step='autodownload-audio';
    try{
      await client.setAutoDownloadAudio(false);step='autodownload-documents';await client.setAutoDownloadDocuments(false);step='autodownload-photos';await client.setAutoDownloadPhotos(false);step='autodownload-videos';await client.setAutoDownloadVideos(false);
      step='compatibilidade-identificadores';await installIdCompatibility(client);
      step='listar-grupos';choices=await groupChoices(client);step='verificar-transporte';await verifyTransport(client);lastTransportCheck=new Date().toISOString();state='conectado';diagnostic=null;error=null;statusFile();
      reauthRequired=false;if(scope.linkRequired){scope.linkRequired=false;persist();statusFile();}assistant.schedule();void recovery.drain();
      const confirmationArg=process.argv.find(arg=>arg.startsWith('--confirm-answer='));if(confirmationArg)await assistant.confirmExistingAnswer(confirmationArg.slice(17));
      if(recovery.meta.enabled)void recoverAutomatic();else{const monthArg=process.argv.find(arg=>arg.startsWith('--import-month='));if(monthArg)void importMonth(monthArg.slice(15));}
    }catch(e){state='erro';diagnostic={step,...errorSummary(e)};error='Falha ao configurar a sessão de leitura. A retomada será tentada novamente.';statusFile();}
  });
  const activeClient=client;
  try{await activeClient.initialize();}catch(e){
    diagnostic=errorSummary(e);qr=null;
    if(client===activeClient)client=null;
    await closeOwnedClient(activeClient);
    state='erro';error='A inicialização falhou. É possível tentar novamente sem apagar a sessão.';statusFile();
  }finally{connecting=false;}
}
function isSession(req){const token=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('session='))?.slice(8);return token&&sessions.has(token);}
async function body(req){let raw='';for await(const part of req){raw+=part;if(raw.length>4096)throw Error('Corpo grande');}return JSON.parse(raw||'{}');}
function send(res,data,code=200){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  if(req.headers.host!==`127.0.0.1:${PORT}`){res.writeHead(403);res.end();return;}
  const url=new URL(req.url,ORIGIN);
  try{
    if(await serveCases(req,res,url))return;
    if(req.method==='GET'&&url.pathname==='/'){
      const token=randomBytes(32).toString('hex');sessions.add(token);if(sessions.size>20)sessions.delete(sessions.values().next().value);
      res.setHeader('Set-Cookie',`session=${token}; HttpOnly; SameSite=Strict; Path=/`);
      res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','text/html; charset=utf-8');res.end(readFileSync(join(ROOT,'web/setup.html')));return;
    }
    if(req.method==='GET'&&['/ui.js','/style.css'].includes(url.pathname)){
      res.setHeader('Content-Type',url.pathname.endsWith('js')?'text/javascript':'text/css');res.end(readFileSync(join(ROOT,url.pathname==='/ui.js'?'web/setup.js':'web/setup.css')));return;
    }
    if(!isSession(req)){send(res,{error:'Abra o painel local para autorizar esta sessão.'},401);return;}
    if(req.method==='GET'&&url.pathname==='/api/status'){send(res,{...health(),qr,groups:choices});return;}
    if(req.method==='GET'&&url.pathname==='/api/month'){
      const month=url.searchParams.get('month');if(!/^20\d\d-(0[1-9]|1[0-2])$/.test(month||''))throw Error('Mês inválido');
      const rows=db.prepare('SELECT id,payload FROM messages WHERE month=? ORDER BY ts LIMIT 500').all(month);
      send(res,{month,untrusted:true,messages:rows.map(r=>JSON.parse(open(KEY,r.payload,r.id)))});return;
    }
    if(req.method==='GET'&&url.pathname==='/api/assistant'){send(res,{untrusted:true,status:assistant.status(),items:assistant.all()});return;}
    if(req.method!=='POST'||req.headers.origin!==ORIGIN||req.headers['content-type']!=='application/json'){send(res,{error:'Operação não autorizada.'},403);return;}
    const data=await body(req);
    if(url.pathname==='/api/connect'){if(data.consent!==true)throw Error('Confirme a vinculação');void connect();send(res,{ok:true});return;}
    if(url.pathname==='/api/select'){
      if(scope.groupId&&scope.groupId!==data.id)throw Error('Grupo já fixado. Pause e peça uma nova configuração para trocar.');
      const selected=choices.find(c=>c.id===data.id);if(!selected)throw Error('Grupo inválido');
      scope={...scope,groupId:selected.id,groupName:selected.name,paused:false};persist();statusFile();send(res,{ok:true});return;
    }
    if(url.pathname==='/api/pause'){scope.paused=!scope.paused;if(!scope.paused){recovery.skipThrough(Date.now()/1000);void recovery.drain();assistant.schedule();}persist();statusFile();send(res,{ok:true});return;}
    if(url.pathname==='/api/questions'){if(typeof data.enabled!=='boolean')throw Error('Estado inválido');scope.questionsEnabled=data.enabled;assistant.enabled=data.enabled;persist();statusFile();if(data.enabled)assistant.schedule();send(res,{ok:true});return;}
    if(url.pathname==='/api/context'){if(!scope.questionsEnabled||scope.paused||typeof data.id!=='string'||data.id.length>500)throw Error('Contexto não autorizado');const record=readSource(data.id);if(!record)throw Error('Fonte não encontrada');void assistant.accept(record).then(()=>assistant.flush());send(res,{ok:true});return;}
    if(url.pathname==='/api/history'){
      if(!scope.groupId||scope.paused)throw Error('Selecione o grupo e ative a captura');
      if(!/^20\d\d-(0[1-9]|1[0-2])$/.test(data.month||''))throw Error('Mês inválido');
      void importMonth(data.month);send(res,{ok:true,started:true});return;
    }
    send(res,{error:'Rota inexistente'},404);
  }catch{send(res,{error:'Operação não concluída. Confira a conexão e o grupo escolhido.'},400);}
});
server.listen(PORT,'127.0.0.1',()=>{console.log('Painel local disponível em '+ORIGIN);if(process.argv.includes('--retry-authorized-link')&&scope.groupId&&!scope.paused&&!reauthRequired)void connect();});
server.on('error',()=>{console.error('Porta local ocupada; nenhuma segunda instância foi iniciada.');process.exitCode=1;});
async function shutdown(){stopping=true;state='parado';statusFile();await queue;await closeOwnedClient(client);server.close();db.close();process.exit(0);}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
