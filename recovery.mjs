import { seal, open } from './core.mjs';

export function recoveryMonths(from,to){
  if(!Number.isFinite(from)||!Number.isFinite(to)||from<0||to<from)throw Error('Intervalo de recuperação inválido');
  const month=t=>{const p=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit'}).formatToParts(new Date(t*1000));return Number(p.find(x=>x.type==='year').value)*12+Number(p.find(x=>x.type==='month').value)-1;};
  const start=month(from),end=month(to);if(end-start>120)throw Error('Intervalo exige revisão');
  return Array.from({length:end-start+1},(_,i)=>`${Math.floor((start+i)/12)}-${String((start+i)%12+1).padStart(2,'0')}`);
}

export class RecoveryQueue{
  constructor({db,key,readSource,deliver,isActive,enable=false,now=()=>Date.now()/1000}){
    Object.assign(this,{db,key,readSource,deliver,isActive,now});this.busy=false;this.lastError=null;this.scan=null;
    db.exec('CREATE TABLE IF NOT EXISTS recovery_meta (id TEXT PRIMARY KEY,payload BLOB NOT NULL); CREATE TABLE IF NOT EXISTS recovery_jobs (id TEXT PRIMARY KEY,ts INTEGER NOT NULL,state TEXT NOT NULL,retry_at REAL NOT NULL DEFAULT 0);');
    const row=db.prepare("SELECT payload FROM recovery_meta WHERE id='recovery'").get();
    this.meta=row?JSON.parse(open(key,row.payload,'recovery')):{enabled:false};
    if(enable&&!this.meta.enabled){const t=now();this.meta={enabled:true,since:t-120,checkpoint:t-120};this.persist();}
    db.exec("UPDATE recovery_jobs SET state='pending' WHERE state='processing'");
  }
  persist(){this.db.prepare("INSERT INTO recovery_meta VALUES('recovery',?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload").run(seal(this.key,Buffer.from(JSON.stringify(this.meta)),'recovery'));}
  offer(record){
    if(!this.meta.enabled||!record||record.timestamp<Math.max(this.meta.since,this.meta.skipBefore||0))return false;
    return this.db.prepare("INSERT OR IGNORE INTO recovery_jobs(id,ts,state) VALUES(?,?,'pending')").run(record.id,record.timestamp).changes>0;
  }
  restore(){if(!this.meta.enabled)return;for(const row of this.db.prepare('SELECT id FROM messages WHERE ts>=? ORDER BY ts,id').all(this.meta.since))this.offer(this.readSource(row.id));}
  window(){const to=this.now();return{from:Math.max(this.meta.since,this.meta.checkpoint-120,this.meta.skipBefore||0),to};}
  completeScan(to){if(!this.meta.enabled)return;this.meta.checkpoint=Math.max(this.meta.checkpoint,Math.min(to,this.now()));this.meta.lastSyncAt=new Date().toISOString();this.persist();}
  skipThrough(to){if(this.meta.enabled){this.meta.checkpoint=Math.max(this.meta.checkpoint,to);this.meta.skipBefore=to;this.persist();}}
  async drain(){
    if(this.busy||!this.meta.enabled||!this.isActive())return;this.busy=true;
    try{
      const jobs=this.db.prepare("SELECT id FROM recovery_jobs WHERE state='pending' AND retry_at<=? ORDER BY ts,id LIMIT 30").all(this.now());
      for(const job of jobs){
        if(!this.isActive())break;
        const record=this.readSource(job.id);if(!record){this.lastError='Fonte arquivada indisponível; recuperação preservada.';break;}
        this.db.prepare("UPDATE recovery_jobs SET state='processing' WHERE id=?").run(job.id);
        try{await this.deliver(record);this.db.prepare("UPDATE recovery_jobs SET state='done',retry_at=0 WHERE id=?").run(job.id);this.lastError=null;}
        catch{this.db.prepare("UPDATE recovery_jobs SET state='pending',retry_at=? WHERE id=?").run(this.now()+60,job.id);this.lastError='Análise aguardando nova tentativa; mensagem preservada.';break;}
      }
    }finally{this.busy=false;}
  }
  status(){return{enabled:this.meta.enabled,busy:this.busy,pending:this.db.prepare("SELECT COUNT(*) AS n FROM recovery_jobs WHERE state!='done'").get().n,lastSyncAt:this.meta.lastSyncAt||null,scan:this.scan,error:this.lastError};}
}
