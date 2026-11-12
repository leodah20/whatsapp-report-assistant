import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {createSupportMail,parseSupportMail} from '../src/cases/support-mail.mjs';
import {ReportAssistant} from '../src/assistant/assistant.mjs';
import {CaseBoard} from '../src/cases/board.mjs';
import {open} from '../src/core.mjs';

const mail=(uid,id,ticket,subject='Re: Atendimento sintético',from='Suporte <atendimento@invenzi.movidesk.com>')=>({
  uid:String(uid),message_id:'<'+id+'@example.invalid>',from,subject,date:'2025-11-06T12:00:00Z',
  text:'Notificação do suporte\n\nO ticket Nº\u00a0'+ticket+' (Atendimento sintético) foi atualizado.\n\nChamado concluído. Aguardar validação local.\nhttps://example.invalid/sem-acesso'
});
test('recognizes an explicit support ticket, redacts links, and rejects imitations',()=>{
  const record=parseSupportMail(mail(1,'first',101));
  assert.equal(record.ticket,'101');
  assert.equal(record.channel,'support-email');
  assert.doesNotMatch(record.text,/https:\/\//);
  assert.equal(parseSupportMail(mail(2,'bad',101,undefined,'invenzi <elsewhere@example.invalid>')),null);
  assert.equal(parseSupportMail({...mail(3,'bad',101),text:'Assunto sem identificador de ticket'}),null);
});
test('each new email updates only its ticket, UID reset deduplicates, and no WhatsApp is sent',async t=>{
  const db=new DatabaseSync(':memory:'),key=randomBytes(32);
  t.after(()=>db.close());
  db.exec('CREATE TABLE messages (id TEXT PRIMARY KEY,month TEXT,ts INTEGER,payload BLOB,media BLOB)');
  const readSource=id=>{const row=db.prepare('SELECT payload FROM support_mail_messages WHERE id=?').get(id);return row?JSON.parse(open(key,row.payload,id)):null;};
  const assistant=new ReportAssistant({db,key,readSource,isActive:()=>true,send:()=>assert.fail('mail must not send WhatsApp')});
  const board=new CaseBoard({db,key,assistant,readSource});
  const requests=[];
  const batches=[
    {uidvalidity:'19',cursor:2,messages:[mail(1,'one',101),mail(2,'two',202)]},
    {uidvalidity:'19',cursor:3,messages:[mail(3,'three',101,'Resolvido: Atendimento sintético')]},
    {uidvalidity:'20',cursor:1,messages:[mail(1,'three',101,'Resolvido: Atendimento sintético')]}
  ];
  const feed=createSupportMail({db,key,assistant,since:'2025-11-01',fetchBatch:async checkpoint=>{requests.push(checkpoint);return batches.shift();}});
  await feed.sync();await feed.sync();await feed.sync();
  assert.deepEqual(requests.map(r=>r.cursor),[0,2,3]);
  assert.equal(feed.status().state,'ready');
  const list=board.list('2025-11').items;
  assert.equal(list.length,2);
  assert.equal(db.prepare('SELECT count(*) AS n FROM messages').get().n,0);
  assert.deepEqual(assistant.all(false),[]);
  const caseRow=list.find(i=>i.externalTicket.number==='101');
  assert.equal(caseRow.externalTicket.lastState,'resolvido');
  assert.equal(caseRow.status,'unconfirmed');
  const detail=board.detail(caseRow.code);
  assert.equal(detail.sources.length,2);
  assert.ok(detail.sources.every(s=>s.kind==='support-email'));
  assert.equal(detail.facts.some(f=>f.automatic),false);
  await assistant.flush();
});
