import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {CaseBoard} from '../src/cases/board.mjs';
import {HistoricalCases} from '../src/cases/history.mjs';
import {ReportAssistant} from '../src/assistant/assistant.mjs';

test('historical preparation creates silent drafts and preserves quoted context for manual linking',async t=>{
  const db=new DatabaseSync(':memory:'),key=randomBytes(32),month='2025-09';t.after(()=>db.close());
  const timestamp=Date.parse('2025-09-03T14:00:00Z')/1000;
  const readSource=id=>({id,month,timestamp,type:'chat',text:id==='a'?'Inspeção de câmera':'Complemento da verificação',...(id==='b'?{quotedId:'a'}:{})});
  db.exec('CREATE TABLE messages(id TEXT PRIMARY KEY,month TEXT NOT NULL,ts INTEGER NOT NULL)');
  for(const id of ['a','b'])db.prepare('INSERT INTO messages VALUES(?,?,?)').run(id,month,timestamp);
  const assistant=new ReportAssistant({db,key,readSource,isActive:()=>true,send:async()=>assert.fail('Histórico não envia mensagens')});
  const board=new CaseBoard({db,key,assistant,readSource});
  const history=new HistoricalCases({db,board,assistant,readSource,analyze:async()=>[{sources:[0],facts:[{field:'ocorrencia',quote:'Inspeção de câmera',source:0}]}]});
  const job=history.prepare(month);
  for(let i=0;i<20&&job.state==='running';i++)await new Promise(resolve=>setImmediate(resolve));
  assert.equal(job.state,'done');assert.equal(job.created,1);
  const [item]=assistant.all();assert.equal(item.historical,true);
  assert.equal(item.intakeState,'silent');assert.equal(item.questionState,'silent');
  assert.deepEqual(history.view(month).sources.map(s=>s.id),['b']);
  history.assign(month,['b'],item.code);
  assert.equal(assistant.all().length,1);
  assert.equal(board.detail(item.code).sources.length,2);
  assert.throws(()=>history.assign(month,['b'],item.code),{status:409});
  await assistant.flush();
});
