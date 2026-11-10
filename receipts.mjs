import { seal, open } from './core.mjs';

const HEADER='Assistente do relatório';
const BODIES={
  updated:'Resposta recebida e informações do chamado atualizadas.',
  partial:'Resposta recebida e informações do chamado atualizadas. Ainda há informações pendentes de confirmação.',
  pending:'Resposta recebida e vinculada ao chamado. A atualização das informações ainda está pendente.'
};
export function receiptText(code,outcome){
  if(!/^R-[A-F0-9]{8}$/.test(code)||!Object.hasOwn(BODIES,outcome))throw Error('Confirmação inválida');
  return `${HEADER} [${code}]\n${BODIES[outcome]}`;
}
export function isReceiptText(text){
  const code=String(text).match(/^Assistente do relatório \[(R-[A-F0-9]{8})\]\n/)?.[1];
  return !!code&&Object.keys(BODIES).some(outcome=>receiptText(code,outcome)===text);
}
function safeError(e){return {name:String(e?.name||'Error').slice(0,60),message:String(e?.message||'Falha na confirmação').replace(/https?:\/\/\S+/g,'[URL]').replace(/\b\d{10,}\b/g,'[identificador]').slice(0,220)};}

export class ReceiptNotifier{
  constructor({db,key,send,isActive}){
    Object.assign(this,{db,key,send,isActive});this.lastError=null;
    db.exec('CREATE TABLE IF NOT EXISTS assistant_receipts (answer_id TEXT PRIMARY KEY, item_id TEXT NOT NULL, message_id TEXT, payload BLOB NOT NULL);');
    // An interrupted analysis is not proof that the case was updated.
    for(const receipt of this.all())if(receipt.state==='awaiting-analysis'){
      receipt.state='ready';receipt.outcome='pending';receipt.recoveredAt=new Date().toISOString();this.save(receipt);
    }
  }
  get(answerId){const row=this.db.prepare('SELECT payload FROM assistant_receipts WHERE answer_id=?').get(answerId);return row?JSON.parse(open(this.key,row.payload,'receipt:'+answerId)):null;}
  all(){return this.db.prepare('SELECT answer_id,payload FROM assistant_receipts').all().map(row=>JSON.parse(open(this.key,row.payload,'receipt:'+row.answer_id)));}
  save(receipt){this.db.prepare('INSERT INTO assistant_receipts VALUES(?,?,?,?) ON CONFLICT(answer_id) DO UPDATE SET message_id=excluded.message_id,payload=excluded.payload').run(receipt.answerId,receipt.itemId,receipt.messageId||null,seal(this.key,Buffer.from(JSON.stringify(receipt)),'receipt:'+receipt.answerId));}
  begin(answerId,item){if(this.get(answerId))return;this.save({answerId,itemId:item.id,code:item.code,state:'awaiting-analysis',createdAt:new Date().toISOString()});}
  async complete(answerId,outcome){
    const receipt=this.get(answerId);if(!receipt||receipt.state!=='awaiting-analysis')return;
    receiptText(receipt.code,outcome);receipt.outcome=outcome;receipt.state='ready';this.save(receipt);await this.notify(answerId);
  }
  async notify(answerId){
    const receipt=this.get(answerId);if(!receipt||receipt.state!=='ready'||!this.isActive())return;
    const today=new Date().toISOString().slice(0,10);
    if(this.all().filter(r=>r.attemptAt?.startsWith(today)).length>=60){this.lastError='Confirmações aguardando o limite diário de envio.';return;}
    receipt.state='sending';receipt.attemptAt=new Date().toISOString();this.save(receipt);
    try{
      const id=await this.send(receiptText(receipt.code,receipt.outcome),answerId,{kind:'receipt',itemId:receipt.itemId,code:receipt.code});
      if(typeof id!=='string'||!id)throw Error('Confirmação sem identificador');
      receipt.state='sent';receipt.messageId=id;this.save(receipt);
      this.db.prepare('INSERT OR IGNORE INTO assistant_links VALUES(?,?)').run(id,receipt.itemId);this.lastError=null;
    }catch(e){
      // A received own-message event can confirm delivery despite a return error.
      const observed=this.get(answerId);
      if(observed?.state==='sent')return;
      receipt.state='delivery-uncertain';receipt.error=safeError(e);this.save(receipt);
      this.lastError='Confirmação sem envio comprovado; não repetida para evitar duplicação.';
    }
  }
  observe(record){
    if(!record.fromMe||!isReceiptText(record.text))return false;
    const receipt=record.quotedId?this.get(record.quotedId):null;
    if(receipt?.outcome&&receiptText(receipt.code,receipt.outcome)===record.text&&['sending','sent','delivery-uncertain'].includes(receipt.state)){
      receipt.state='sent';receipt.messageId=record.id;this.save(receipt);
      this.db.prepare('INSERT OR IGNORE INTO assistant_links VALUES(?,?)').run(record.id,receipt.itemId);
      this.lastError=null;
    }
    return true; // A confirmation never becomes a new question or activity.
  }
  async flush(){for(const receipt of this.all())if(receipt.state==='ready')await this.notify(receipt.answerId);}
  status(){const receipts=this.all();return {confirmationsSent:receipts.filter(r=>r.state==='sent').length,confirmationsPending:receipts.filter(r=>['ready','awaiting-analysis'].includes(r.state)).length,confirmationError:this.lastError};}
}
