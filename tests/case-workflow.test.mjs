import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import {CaseBoard} from '../src/cases/board.mjs';
import {ReportAssistant} from '../src/assistant/assistant.mjs';
import {HistoricalCases} from '../src/cases/history.mjs';
import {createCaseHandler} from '../src/cases/http.mjs';
import {followupMatch} from '../src/assistant/followup.mjs';
import {seal,open} from '../src/core.mjs';

const month='2025-09',t0=1757000000;
function setup(t){
  const db=new DatabaseSync(':memory:'),key=randomBytes(32);t.after(()=>db.close());
  db.exec('CREATE TABLE messages(id TEXT PRIMARY KEY,month TEXT NOT NULL,ts INTEGER NOT NULL,payload BLOB NOT NULL,media BLOB)');
  const readSource=id=>{const row=db.prepare('SELECT payload FROM messages WHERE id=?').get(id);return row?JSON.parse(open(key,row.payload,id)):null;};
  const assistant=new ReportAssistant({db,key,readSource,isActive:()=>false,send:async()=>assert.fail('Não envia mensagens')});
  const board=new CaseBoard({db,key,assistant,readSource});
  function add(id,code,text,timestamp=t0){
    const record={id,month,timestamp,text,type:'chat'};
    db.prepare('INSERT INTO messages VALUES(?,?,?,?,NULL)').run(id,month,timestamp,seal(key,Buffer.from(JSON.stringify(record)),id));
    const item={id:'case:'+id,code,month,sourceIds:[id],answerIds:[],facts:[],missing:['local','equipamento','ocorrencia','procedimento','resultado'],historical:true,review:'needs-review',createdAt:'2025-09-04T00:00:00Z',questionState:'silent',intakeState:'silent'};
    assistant.save(item);db.prepare('INSERT INTO assistant_links VALUES(?,?)').run(id,item.id);return item;
  }
  return {db,key,readSource,board,assistant,add};
}
test('manual answers persist independently and photo is encrypted and linked to the case',t=>{
  const {board,add,db,key}=setup(t);const item=add('one','R-11111111','Fonte documentada');
  const saved=board.change(item.code,{kind:'context',version:0,location:'Torre A, recepção',serviceDay:'2025-09-04',answers:{equipamento:'Equipamento A',ocorrencia:'Sem resposta',procedimento:'Vistoria',resultado:'Em análise'}});
  assert.equal(saved.contextState,'complete');assert.equal(saved.status,'unconfirmed');
  assert.equal(saved.facts.filter(f=>f.confirmed).length,5);
  const picture=Buffer.from([255,216,255,1,2,3]);
  assert.throws(()=>board.addPhoto(item.code,Buffer.from('invalid'),'image/jpeg'));
  const updated=board.addPhoto(item.code,picture,'image/jpeg'),photo=updated.sources.find(s=>s.kind==='manual-photo');
  const data=db.prepare('SELECT media FROM messages WHERE id=?').get(photo.id).media;
  assert(!Buffer.from(data).equals(picture));assert.deepEqual(open(key,data,photo.id+':media'),picture);
});
test('historical media and case picker use local session; ignore and restore preserve original evidence',async t=>{
  const {db,key,board,assistant,readSource,add}=setup(t);
  const current=add('linked','R-00000001','Atendimento concluído.');
  const existing=add('old','R-00000002','Chamado arquivado.');
  board.change(existing.code,{kind:'archive',version:0,text:'Arquivo sintético'});
  const photo=Buffer.from([255,216,255,1,2,3]),html=Buffer.from('<html><script>throw Error()</script></html>');
  function insert(id,bytes,mime,filename){
    const record={id,month,timestamp:t0,text:'Legenda\nOriginal',type:'image',hasMedia:true,mediaState:'saved',mime,filename};
    db.prepare('INSERT INTO messages VALUES(?,?,?,?,?)').run(id,month,t0,seal(key,Buffer.from(JSON.stringify(record)),id),seal(key,bytes,id+':media'));
  }
  insert('source /+1',photo,'image/jpeg','foto.jpg');
  insert('document',html,'text/html','../arquivo.html');
  const historical=new HistoricalCases({db,board,assistant,readSource});
  let handle,origin;
  const server=createServer((req,res)=>void handle(req,res,new URL(req.url,origin)));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  origin='http://127.0.0.1:'+server.address().port;
  handle=createCaseHandler({origin,root:fileURLToPath(new URL('../',import.meta.url)),board,historical,readMedia:id=>{
    const {media}=db.prepare('SELECT media FROM messages WHERE id=?').get(id);
    return open(key,media,id+':media');
  }});
  const url=origin+'/api/cases/history',query='?month='+month,preview=id=>url+'/media?'+new URLSearchParams({month,id});
  assert.equal((await fetch(preview('source /+1'))).status,401);
  const page=await fetch(origin+'/historico'),cookie=page.headers.get('set-cookie').split(';')[0];await page.body.cancel();
  const get=(p,extra)=>fetch(p,{headers:{cookie,...extra}});
  const post=(kind,ids,code='',from=origin)=>fetch(url+query,{method:'POST',headers:{cookie,origin:from,'Content-Type':'application/json'},body:JSON.stringify({kind,ids,code})});
  const rows=(await (await get(url+query)).json()).sources;
  assert.equal(rows.find(x=>x.id==='source /+1').text,'Legenda\nOriginal');
  assert.equal(rows.find(x=>x.id==='source /+1').mediaKind,'image');
  assert.deepEqual((await (await get(url+query+'&targets=1')).json()).targets.map(x=>x.code),[current.code]);
  assert.equal((await get(preview('linked'))).status,404);
  assert.equal((await get(preview('source /+1').replace(month,'2025-10'))).status,404);
  const partial=await get(preview('source /+1'),{range:'bytes=1-3'});
  assert.equal(partial.status,206);assert.equal(partial.headers.get('content-range'),'bytes 1-3/6');
  assert.deepEqual(Buffer.from(await partial.arrayBuffer()),photo.subarray(1,4));
  assert.equal((await get(preview('source /+1'),{range:'bytes=99-100'})).status,416);
  const attachment=await get(preview('document'));
  assert.equal(attachment.headers.get('content-type'),'application/octet-stream');
  assert.equal(attachment.headers.get('content-disposition'),'attachment; filename="arquivo.html"');
  assert.deepEqual(Buffer.from(await attachment.arrayBuffer()),html);
  assert.equal((await post('ignore',['source /+1'],'','https://example.invalid')).status,403);
  assert.equal((await post('ignore',['source /+1','missing'])).status,409);
  assert.equal((await get(preview('source /+1'))).status,200);
  assert.equal((await post('ignore',['source /+1'])).status,200);
  assert.equal((await get(preview('source /+1'))).status,404);
  assert.equal((await get(preview('source /+1')+'&ignored=1')).status,200);
  assert.equal((await post('assign',['source /+1'],current.code)).status,409);
  await assistant.accept({...readSource('source /+1'),text:'Atualização '+current.code});
  assert.ok(!board.item(current.code).sourceIds.includes('source /+1'));
  assert.equal((await post('restore',['source /+1'])).status,200);
  assert.equal((await post('assign',['source /+1'],current.code)).status,200);
  assert.equal((await get(preview('source /+1'))).status,404);
  assert.ok(board.item(current.code).sourceIds.includes('source /+1'));
});
test('existing context exposes the documented blocker without a separate task',t=>{
  const {board,add}=setup(t);const item=add('one','R-11111111','Vistoria de um sensor.');
  const saved=board.change(item.code,{kind:'context',version:0,location:'Setor A',serviceDay:'',answers:{resultado:'Status: Abortado.',procedimento:'Vamos precisar que seja retirado o material para acessar o sensor.'}});
  assert.equal(saved.status,'pending');assert.equal(saved.stage.origin,'context');assert.match(saved.stage.reason,/retirado o material/);
  assert.equal(saved.openTasks,0);assert.equal(saved.stageQuestion,null);
  assert.equal(board.list(month).items[0].status,'pending');
});
test('context stage is audited, validated and can return to the evidence',t=>{
  const {board,add}=setup(t);const item=add('one','R-11111111','Aguardando a entrega da peça.');
  const context={kind:'context',version:0,location:'',serviceDay:'',answers:{}};
  assert.throws(()=>board.change(item.code,{...context,stage:{status:'inventado'}}),/Etapa inválida/);
  assert.throws(()=>board.change(item.code,{...context,stage:{status:'pending'}}),/Texto vazio/);
  assert.throws(()=>board.change(item.code,{...context,stage:{status:'rescheduled',reason:'Mudança de horário',scheduledFor:'2027-02-30'}}),/data de remarcação/);
  const saved=board.change(item.code,{...context,stage:{status:'rescheduled',reason:'Mudança de horário',scheduledFor:'2027-02-02'}});
  assert.equal(saved.status,'rescheduled');assert.equal(saved.stage.origin,'manual');assert.equal(saved.stage.scheduledFor,'2027-02-02');
  assert.equal(saved.serviceDay,null);assert.equal(saved.profile.events.at(-1).after.status,'rescheduled');
  assert.throws(()=>board.change(item.code,{...context,stage:{status:'unconfirmed'}}),/atualizado/);
  const restored=board.change(item.code,{...context,version:1,stage:{status:'unconfirmed'}});
  assert.equal(restored.status,'pending');assert.equal(restored.stage.origin,'source');
});
test('merge keeps chronological sources, routes old reply links and archives the duplicate',t=>{
  const {board,add,assistant,db}=setup(t),a=add('old','R-11111111','Falha',t0),b=add('new','R-22222222','Atualização',t0+86400);
  const merged=board.change(a.code,{kind:'merge',version:0,duplicate:b.code});
  assert.deepEqual(merged.sources.map(s=>s.id),['old','new']);
  assert.equal(board.list(month).items.length,1);
  assert.equal(board.detail(b.code).profile.archived.reason,'Reunido ao chamado '+a.code);
  assert.equal(assistant.all().find(i=>i.id===b.id).mergedInto,a.id);
  assert.equal(db.prepare('SELECT item_id FROM assistant_links WHERE message_id=?').get('new').item_id,a.id);
  assert.throws(()=>board.change(b.code,{kind:'restore',version:1}),{status:409});
});
test('follow-up across days requires explicit unique identity; ambiguous similarities need review',()=>{
  const one={id:'case:a',code:'R-11111111',text:'Ramal 1234 no setor A'};
  assert.equal(followupMatch('Atualização do ramal 1234: permanece em análise.',[one]).target,one.id);
  assert.equal(followupMatch('Novo chamado do ramal 1234',[one]).review,false);
  assert.equal(followupMatch('Atualização do ramal 1234',[one,{...one,id:'case:b',code:'R-22222222'}]).target,null);
  const related={id:'case:c',code:'R-33333333',text:'Falha switch de acesso corporativo'};
  assert.deepEqual(followupMatch('Após troca de GBIC, switch de acesso corporativo voltou',[related]),{target:null,candidates:[related.code],review:true});
});
test('context scan only adds literal evidence, never overwrites confirmed answers or closes',async t=>{
  const {db,board,add,assistant,readSource}=setup(t),item=add('one','R-11111111','Foi feita vistoria');
  board.change(item.code,{kind:'context',version:0,location:'Setor A',serviceDay:'',answers:{resultado:'Pendente'}});
  const history=new HistoricalCases({db,board,assistant,readSource,analyze:async()=>[{sources:[0],facts:[{field:'procedimento',source:0,quote:'feita vistoria'},{field:'resultado',source:0,quote:'fabricado'}]}]});
  const job=history.recheck(month);
  for(let i=0;i<20&&job.state==='running';i++)await new Promise(resolve=>setImmediate(resolve));
  assert.equal(job.created,1);
  const d=board.detail(item.code);assert.equal(d.status,'unconfirmed');
  assert(d.facts.some(f=>f.quote==='feita vistoria'));assert(d.facts.some(f=>f.confirmed&&f.quote==='Pendente'));
  assert(!d.facts.some(f=>f.quote==='fabricado'));
});
