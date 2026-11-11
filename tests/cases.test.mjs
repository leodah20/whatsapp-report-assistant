import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import {CaseBoard,suggestArea,imageType} from '../src/cases/board.mjs';
import {createCaseHandler} from '../src/cases/http.mjs';
import {MonthlyClosing} from '../src/cases/closing.mjs';

const code='R-ABCDEF12',id='case:synthetic',occurredOn='2025-10-03';
test('source timestamp is distinct from confirmed service day and location',t=>{
  const {board,item}=fixture(t);
  item.facts.push({field:'local',quote:'15 pavimento porta encontra fora do padrão e não fecha'});
  const before=board.detail(code);
  assert.equal(before.serviceDay,null);
  assert.equal(before.referenceKind,'source');
  assert.equal(before.location,'15 pavimento');
  assert.equal(before.locationConfirmed,false);
  const after=board.change(code,{version:0,kind:'profile',area:'SCA',title:'Porta',status:'unconfirmed',note:'',occurredOn:'',location:'Torre A, 15º pavimento',serviceDay:'2025-09-04'});
  assert.equal(after.serviceDay,'2025-09-04');assert.equal(after.locationConfirmed,true);
  assert.equal(after.referenceAt,before.referenceAt);
});
test('monthly draft requires manual dates, evidence review and preventive confirmation',t=>{
  const {board,db,source,dependencies}=fixture(t);
  const groups=Array.from({length:6},(_,n)=>({name:'Grupo '+n,rows:[['1','Tarefa sintética','Técnico']]}));
  let revision='a';
  const closing=new MonthlyClosing({db,key:dependencies.key,board,template:()=>({name:'Exemplo',footer:'Exemplo',groups}),archive:()=>({count:1,revision})});
  const month='2025-09',initial=closing.get(month);
  assert.throws(()=>closing.draft(month),{status:409});
  const review={kind:'review',version:0,code,stamp:initial.items[0].stamp,decision:'include',title:'Verificação',narrative:'A causa permanece em análise.',start:'',end:'',photos:[0],verified:true};
  assert.throws(()=>closing.save(month,review),/data real/);
  assert.throws(()=>closing.save(month,{...review,start:'2025-10-01'}),/competência/);
  const edited=closing.save(month,{...review,start:'2025-09-04'});
  assert.throws(()=>closing.save(month,{...review,start:'2025-09-04'}),{status:409});
  const settings={kind:'settings',version:1,issued:'2025-10-02',statuses:Array(6).fill('unknown'),observations:'',coverage:edited.coverage};
  assert.throws(()=>closing.save(month,{...settings,statuses:[]}),/status/);
  closing.save(month,settings);
  const output=closing.draft(month);
  assert.equal(output.items[0].start,'2025-09-04');
  assert.equal(output.items[0].narrative,review.narrative);
  assert.equal(output.settings.statuses[0],'unknown');
  revision='b';assert.throws(()=>closing.draft(month),{status:409});
  source.text='Evidência revisada';
  assert.equal(closing.get(month).items[0].state,'stale');
});
test('archiving removes case from closing and can be reversed without losing sources',t=>{
  const {board,db,dependencies}=fixture(t);
  const month='2025-09',closing=new MonthlyClosing({db,key:dependencies.key,board,template:()=>null});
  board.change(code,{version:0,kind:'archive',text:'Duplicado; ver chamado principal.'});
  assert.equal(board.list(month).items.length,0);
  assert.equal(board.list(month,false,true).items[0].archived,true);
  assert.equal(closing.get(month).items.length,0);
  assert.equal(board.detail(code).sources.length,1);
  assert.equal(board.detail(code).profile.events[0].kind,'archive');
  board.change(code,{version:1,kind:'restore'});
  assert.equal(closing.get(month).items.length,1);
  assert.equal(board.detail(code).profile.events[1].kind,'restore');
});
function fixture(t){
  const db=new DatabaseSync(':memory:');t.after(()=>db.close());
  const item={id,code,month:'2025-09',sourceIds:['a'],answerIds:[],facts:[{field:'equipamento',quote:'Câmera de teste'}],review:'draft-ready',missing:[],createdAt:'2025-09-05T12:00:00Z'};
  const source={id:'a',timestamp:Date.parse(item.createdAt)/1000,month:item.month,text:'Câmera de teste',mediaState:'saved',mime:'image/jpeg'};
  const dependencies={db,key:randomBytes(32),assistant:{all:()=>[item]},readSource:key=>key==='a'?source:null};
  return {db,item,source,board:new CaseBoard(dependencies),dependencies};
}
test('seven fronts can be suggested; ambiguous evidence stays unclassified',()=>{
  for(const [sample,area] of Object.entries({'câmera':'CFTV','chave de fluxo':'SDAI','controle de acesso':'SCA','rede de interfonia':'PABX','hidrômetro':'MEDICAO','BACnet':'BMS','Zabbix':'ZABBIX'}))assert.equal(suggestArea(sample).area,area);
  assert.equal(suggestArea('câmera e interfone').area,'UNCLASSIFIED');
});
test('draft readiness does not close a technical case; dated updates cross months',t=>{
  const {board,item,db,dependencies}=fixture(t);
  assert.equal(board.detail(code).status,'unconfirmed');
  const update={kind:'note',version:0,text:'Verificação manual sintética',occurredOn};
  assert.equal(board.list('2025-10').items.length,0);
  assert.equal(board.list('2025-10',true).items[0].carryover,true);
  board.change(code,update);
  assert.equal(board.list('2025-10').items[0].carryover,false);
  assert.equal(item.facts.length,1);
  assert.equal(new CaseBoard(dependencies).detail(code).profile.events[0].text,update.text);
  assert(!Buffer.from(db.prepare('SELECT payload FROM case_profiles').get().payload).includes(Buffer.from(update.text)));
  assert.throws(()=>board.change(code,update),e=>e.status===409);
});
test('manual closure requires a date and reason and preserves open tasks',t=>{
  const {board}=fixture(t);
  const item=board.change(code,{kind:'task',version:0,text:'Validar operação',occurredOn});
  const edit={kind:'profile',version:1,area:'SCA',title:'Equipamento de teste',status:'completed',occurredOn};
  assert.throws(()=>board.change(code,edit));
  const saved=board.change(code,{...edit,note:'Operação confirmada em bancada.'});
  assert.equal(saved.area,'SCA');assert.equal(saved.status,'completed');assert.equal(saved.openTasks,1);
  const resolved=board.change(code,{kind:'resolve',version:2,text:'Validação registrada',occurredOn,taskId:item.profile.tasks[0].id});
  assert.equal(resolved.openTasks,0);assert.equal(resolved.profile.events.length,3);
});
test('rejects unsupported image content and invalid dates',t=>{
  const {board}=fixture(t);
  assert.equal(imageType(Buffer.from('<svg/>'),'image/jpeg'),null);
  assert.equal(imageType(Buffer.from([255,216,255,0]),'image/jpeg'),'image/jpeg');
  assert.throws(()=>board.change(code,{kind:'note',version:0,text:'Teste',occurredOn:'2025-02-31'}));
});
test('case HTTP requires local session and origin for writes',async t=>{
  const {board}=fixture(t);
  let handler,origin;
  const server=createServer((req,res)=>void handler(req,res,new URL(req.url,origin)));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  origin='http://127.0.0.1:'+server.address().port;
  handler=createCaseHandler({origin,root:fileURLToPath(new URL('../',import.meta.url)),board,readMedia:()=>Buffer.from([255,216,255,0])});
  const url=origin+'/api/cases/'+code;
  assert.equal((await fetch(url)).status,401);
  const page=await fetch(origin+'/chamados'),cookie=page.headers.get('set-cookie').split(';')[0];
  assert.equal(page.status,200);
  assert.equal((await fetch(url+'/media/0',{headers:{cookie}})).headers.get('content-type'),'image/jpeg');
  assert.equal((await fetch(url+'/media/1',{headers:{cookie}})).status,404);
  const options={method:'POST',headers:{cookie,'content-type':'application/json',origin:'https://example.invalid'},body:JSON.stringify({kind:'note',version:0,text:'Exemplo sintético',occurredOn})};
  assert.equal((await fetch(url,options)).status,403);
  options.headers.origin=origin;
  assert.equal((await fetch(url,options)).status,200);
  assert.equal((await (await fetch(url,{headers:{cookie}})).json()).profile.events.length,1);
});
