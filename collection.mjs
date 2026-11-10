import{seal,open}from'./core.mjs';
export const COLLECTION_TEXT='Assistente do relatório\nRegistro recebido e salvo para análise. Se faltar contexto, envio uma pergunta.';
export class CollectionNotifier{
  constructor({db,key,send,isActive}){Object.assign(this,{db,key,send,isActive});db.exec('CREATE TABLE IF NOT EXISTS collection_notices(id TEXT PRIMARY KEY,ts INTEGER NOT NULL,payload BLOB NOT NULL);');}
  get(id){const row=this.db.prepare('SELECT payload FROM collection_notices WHERE id=?').get(id);return row?JSON.parse(open(this.key,row.payload,'collection:'+id)):null;}
  all(){return this.db.prepare('SELECT id,payload FROM collection_notices ORDER BY ts DESC').all().map(row=>JSON.parse(open(this.key,row.payload,'collection:'+row.id)));}
  save(notice){this.db.prepare('INSERT INTO collection_notices VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').run(notice.id,notice.timestamp,seal(this.key,Buffer.from(JSON.stringify(notice)),'collection:'+notice.id));}
  async consider(record){
    if(!record||record.type==='album'||record.quotedId||record.hasQuotedMsg||record.text.startsWith('Assistente do relatório'))return;
    if(!record.hasMedia&&(!record.text.trim()||/^(bom dia|boa tarde|boa noite|ok|obrigad[oa]|valeu|certo|beleza|sim|n[aã]o|👍|🙏)[!.,\s]*$/iu.test(record.text.trim())))return;
    if(this.get(record.id))return;
    const previous=this.all().find(r=>Math.abs(r.timestamp-record.timestamp)<=120&&(!record.text.trim()||r.caption===record.text));
    if(previous)return;
    this.save({id:record.id,timestamp:record.timestamp,caption:record.text,state:'ready'});await this.notify(record.id);
  }
  async notify(id){
    const notice=this.get(id);if(!notice||notice.state!=='ready'||!this.isActive())return;
    const today=new Date().toISOString().slice(0,10);if(this.all().filter(n=>n.attemptAt?.startsWith(today)).length>=60)return;
    notice.state='sending';notice.attemptAt=new Date().toISOString();this.save(notice);
    try{const sent=await this.send(COLLECTION_TEXT,id,{kind:'collection'});if(!sent)throw Error('Envio sem confirmação');notice.state='sent';notice.messageId=sent;}
    catch{notice.state='delivery-uncertain';}
    this.save(notice);
  }
  async flush(){for(const notice of this.all())if(notice.state==='ready')await this.notify(notice.id);}
  status(){const notices=this.all();return{receivedNotices:notices.filter(n=>n.state==='sent').length,receivedNoticesPending:notices.filter(n=>n.state==='ready').length};}
}
