import {randomBytes} from 'node:crypto';
import {CaseError} from './board.mjs';
import {analyzeSources,isChatter,ownAssistant,FIELDS} from '../assistant/assistant.mjs';

export class HistoricalCases{
  constructor({db,board,assistant,readSource,analyze=analyzeSources}){Object.assign(this,{db,board,assistant,readSource,analyze});this.jobs=new Map();this.running=false;}
  unlinked(month){
    if(!/^20\d\d-(0[1-9]|1[0-2])$/.test(month||''))throw new CaseError('Competência inválida.');
    return this.db.prepare(`SELECT m.id FROM messages m WHERE m.month=?
      AND NOT EXISTS (SELECT 1 FROM assistant_links l WHERE l.message_id=m.id)
      AND NOT EXISTS (SELECT 1 FROM assistant_inbox i WHERE i.id=m.id)
      ORDER BY m.ts,m.id`).all(month).map(({id})=>this.readSource(id)).filter(r=>r&&r.type!=='album'&&!ownAssistant(r)&&!isChatter(r)&&(r.hasMedia||r.text?.trim()));
  }
  view(month,offset=0){
    if(!Number.isInteger(offset)||offset<0)throw new CaseError('Página inválida.');
    const sources=this.unlinked(month);
    return {count:sources.length,offset,sources:sources.slice(offset,offset+50),job:this.jobs.get(month)||null};
  }
  saveGroup(records,analysis,code=null){
    this.db.exec('BEGIN IMMEDIATE');
    try{
      const link=this.db.prepare('INSERT INTO assistant_links VALUES (?,?)');
      const seen=this.db.prepare('SELECT 1 FROM assistant_links WHERE message_id=?');
      const inQueue=this.db.prepare('SELECT 1 FROM assistant_inbox WHERE id=?');
      if(records.some(r=>seen.get(r.id)||inQueue.get(r.id)))throw new CaseError('Uma fonte já entrou em outro chamado ou na análise. Recarregue.',409);
      let item;
      if(code){
        item=this.board.item(code);
        if(this.board.profile(item.id).archived)throw new CaseError('Restaure o chamado antes de vincular fontes.',409);
        item.sourceIds=[...new Set([...item.sourceIds,...records.map(r=>r.id)])];
        item.updatedAt=new Date().toISOString();
      }else{
        const facts=(analysis?.facts||[]).map(f=>({...f,sourceId:analysis.batch[f.source].id}));
        item={id:'case:'+randomBytes(16).toString('hex'),code:'R-'+randomBytes(4).toString('hex').toUpperCase(),month:records[0].month,
          sourceIds:records.map(r=>r.id),answerIds:[],facts,missing:FIELDS.filter(f=>!facts.some(x=>x.field===f)),review:'needs-review',
          historical:true,createdAt:new Date().toISOString(),questionState:'silent',intakeState:'silent'};
      }
      this.assistant.save(item);
      for(const r of records){link.run(r.id,item.id);this.db.prepare("INSERT INTO assistant_inbox VALUES(?,?,'processed')").run(r.id,r.timestamp);}
      this.db.exec('COMMIT');return item.code;
    }catch(e){this.db.exec('ROLLBACK');throw e;}
  }
  assign(month,ids,code){
    if(!Array.isArray(ids)||!ids.length||ids.length>24||new Set(ids).size!==ids.length||ids.some(i=>typeof i!=='string'||i.length>500))throw new CaseError('Selecione até 24 fontes.');
    const selected=this.unlinked(month).filter(r=>ids.includes(r.id));
    if(selected.length!==ids.length)throw new CaseError('Fonte não disponível neste período.',409);
    return this.saveGroup(selected,null,code||null);
  }
  prepare(month,before=null){
    if(this.running)throw new CaseError('Já existe uma preparação de histórico em andamento.',409);
    if(before!==null&&(typeof before!=='string'||!/^20\d\d-\d\d-\d\d$/.test(before)||!before.startsWith(month+'-')))throw new CaseError('Limite de período inválido.');
    const local=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'});
    const input=this.unlinked(month).filter(r=>!r.quotedId&&!/\bR-[A-F0-9]{8}\b/i.test(r.text||'')&&(!before||local.format(new Date(r.timestamp*1000))<before)).slice(0,72);
    const job={state:'running',scanned:0,total:input.length,created:0,failed:0,needsReview:0};
    this.jobs.set(month,job);this.running=true;
    void (async()=>{
      try{
        for(let i=0;i<input.length;){
          const first=input[i],batch=[];
          while(i<input.length&&batch.length<6&&input[i].timestamp<=first.timestamp+180)batch.push(input[i++]);
          if(batch.every(r=>!r.text.trim())){job.scanned+=batch.length;job.needsReview+=batch.length;continue;}
          try{
            const analysis=await this.analyze(batch);
            for(const entry of analysis){
              if(!entry.facts.some(f=>['equipamento','ocorrencia','procedimento'].includes(f.field))){
                job.needsReview+=entry.sources.length;continue;
              }
              try{this.saveGroup(entry.sources.map(n=>batch[n]),{...entry,batch});job.created++;}
              catch{job.failed+=entry.sources.length;}
            }
          }catch{job.failed+=batch.length;}
          job.scanned+=batch.length;
        }
      }finally{job.state='done';this.running=false;}
    })();
    return job;
  }
}
