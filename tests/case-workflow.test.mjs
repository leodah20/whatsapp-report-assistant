import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {CaseBoard} from '../src/cases/board.mjs';
import {ReportAssistant} from '../src/assistant/assistant.mjs';
import {HistoricalCases} from '../src/cases/history.mjs';
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
