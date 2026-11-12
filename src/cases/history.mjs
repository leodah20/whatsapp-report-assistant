import {randomBytes} from 'node:crypto';
import {CaseError,STATUSES} from './board.mjs';
import {analyzeSources,isChatter,ownAssistant,FIELDS} from '../assistant/assistant.mjs';
import {CONTEXT_SECONDS,followingContext,isUncaptionedMedia} from '../assistant/media-context.mjs';
import {historyMediaKind} from './history-media.mjs';

const unlinked='NOT EXISTS (SELECT 1 FROM assistant_links l WHERE l.message_id=m.id)';
const unclaimed=unlinked+' AND NOT EXISTS (SELECT 1 FROM assistant_inbox i WHERE i.id=m.id)';
const ignored=unlinked+" AND EXISTS (SELECT 1 FROM assistant_inbox i WHERE i.id=m.id AND i.state='ignored')";
const validMonth=month=>/^20\d\d-(0[1-9]|1[0-2])$/.test(month||'');
const visible=r=>r&&r.type!=='album'&&!ownAssistant(r)&&!isChatter(r)&&(r.hasMedia||r.text?.trim());
function checkIds(ids){
  if(!Array.isArray(ids)||!ids.length||ids.length>24||new Set(ids).size!==ids.length||ids.some(i=>typeof i!=='string'||!i.length||i.length>500))throw new CaseError('Selecione até 24 fontes.');
}

export class HistoricalCases{
  constructor({db,board,assistant,readSource,analyze=analyzeSources}){Object.assign(this,{db,board,assistant,readSource,analyze});this.jobs=new Map();this.running=false;}
  unlinked(month,showIgnored=false){
    if(!validMonth(month))throw new CaseError('Competência inválida.');
    return this.db.prepare(`SELECT m.id FROM messages m WHERE m.month=? AND ${showIgnored?ignored:unclaimed}
      ORDER BY m.ts,m.id`).all(month).map(({id})=>this.readSource(id)).filter(visible);
  }
  mediaSource(month,id,showIgnored=false){
    if(!validMonth(month)||typeof id!=='string'||!id.length||id.length>500)throw new CaseError('Registro inválido.');
    const row=this.db.prepare(`SELECT m.id FROM messages m WHERE m.month=? AND m.id=? AND ${showIgnored?ignored:unclaimed}`).get(month,id);
    const source=row&&this.readSource(row.id);
    if(!visible(source)||!source.hasMedia||source.mediaState!=='saved')throw new CaseError('Anexo indisponível neste histórico.',404);
    return source;
  }
  targets(month){
    if(!validMonth(month))throw new CaseError('Competência inválida.');
    return this.board.summaries().filter(i=>!i.externalTicket).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt))).map(i=>({
      code:i.code,title:i.title,location:i.location,area:i.area,month:i.originMonth,
      current:i.activityMonths.includes(month),day:i.serviceDay,referenceAt:i.referenceAt,status:STATUSES[i.status]
    }));
  }
  view(month,offset=0,showIgnored=false){
    if(!Number.isInteger(offset)||offset<0)throw new CaseError('Página inválida.');
    const sources=this.unlinked(month,showIgnored);
    const items=new Map(this.assistant.all().map(i=>[i.id,i.code]));
    return {count:sources.length,unlinkedCount:showIgnored?this.unlinked(month).length:sources.length,offset,sources:sources.slice(offset,offset+50).map(record=>{
      const source=record.hasMedia&&record.mediaState==='saved'?{...record,mediaKind:historyMediaKind(record)}:record;
      if(!isUncaptionedMedia(source)){
        const suggested=this.assistant.followup?.(source);
        return suggested?.review?{...source,followupSuggestion:suggested.candidates}:source;
      }
      const after=this.db.prepare(`SELECT id FROM messages WHERE month=? AND ts<=?
        AND NOT EXISTS (SELECT 1 FROM assistant_inbox i WHERE i.id=messages.id AND i.state='ignored')
        AND (ts>? OR (ts=? AND rowid>(SELECT rowid FROM messages WHERE id=?)))
        ORDER BY ts,rowid LIMIT 24`).all(month,source.timestamp+CONTEXT_SECONDS,source.timestamp,source.timestamp,source.id);
      const hint=followingContext(source,after.map(({id})=>this.readSource(id)),r=>r.type!=='album'&&!ownAssistant(r)&&!isChatter(r));
      if(!hint)return {...source,contextSuggestion:null};
      const linked=this.db.prepare('SELECT item_id FROM assistant_links WHERE message_id=?').get(hint.record.id);
      return {...source,contextSuggestion:{basis:hint.basis,text:hint.record.text.slice(0,300),code:items.get(linked?.item_id)||null,timestamp:hint.record.timestamp}};
    }),job:this.jobs.get(month)||null};
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
        if(item.externalTicket)throw new CaseError('Tickets de suporte recebem fontes pelo conector de e-mail.',409);
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
  ignore(month,ids,restore=false){
    if(!validMonth(month))throw new CaseError('Competência inválida.');
    checkIds(ids);
    this.db.exec('BEGIN IMMEDIATE');
    try{
      const lookup=this.db.prepare(`SELECT m.id,m.ts FROM messages m WHERE m.month=? AND m.id=? AND ${restore?ignored:unclaimed}`);
      const change=this.db.prepare(restore?"DELETE FROM assistant_inbox WHERE id=? AND state='ignored'":"INSERT INTO assistant_inbox VALUES(?,?,'ignored')");
      for(const id of ids){
        const row=lookup.get(month,id);
        if(!row||!visible(this.readSource(id)))throw new CaseError('Um registro mudou de situação. Recarregue o histórico.',409);
        if(restore)change.run(id);else change.run(id,row.ts);
      }
      this.db.exec('COMMIT');return {count:ids.length};
    }catch(e){this.db.exec('ROLLBACK');throw e;}
  }
  assign(month,ids,code){
    checkIds(ids);
    const selected=this.unlinked(month).filter(r=>ids.includes(r.id));
    if(selected.length!==ids.length)throw new CaseError('Fonte não disponível neste período.',409);
    return this.saveGroup(selected,null,code||null);
  }
  recheck(month){
    if(this.running)throw new CaseError('Já existe uma varredura em andamento.',409);
    const items=this.board.list(month,true).items.filter(i=>i.contextState!=='complete')
      .sort((a,b)=>b.missing.length-a.missing.length||a.referenceAt-b.referenceAt).slice(0,40);
    const job={kind:'context',state:'running',total:items.length,scanned:0,created:0,failed:0,needsReview:0};
    this.jobs.set(month,job);this.running=true;
    const fingerprint=sources=>JSON.stringify(sources.map(s=>[s.id,s.text,s.timestamp]));
    void (async()=>{
      try{
        for(const row of items){
          try{
            const item=this.board.item(row.code),sources=this.board.sources(item),prior=fingerprint(sources);
            const text=sources.filter(s=>s.text?.trim());
            if(!text.length){job.needsReview++;continue;}
            const extracted=[];
            for(let i=0;i<text.length;i+=6){
              const chunk=text.slice(i,i+6),result=await this.analyze(chunk);
              for(const entry of result)for(const f of entry.facts){
                if(FIELDS.includes(f.field)&&typeof f.quote==='string'&&f.quote.trim()&&chunk[f.source]?.text.includes(f.quote))extracted.push({...f,sourceId:chunk[f.source].id});
              }
            }
            const current=this.board.item(row.code);
            if(this.board.profile(current.id).archived||fingerprint(this.board.sources(current))!==prior){job.needsReview++;continue;}
            if(!extracted.length){job.needsReview++;continue;}
            const pairs=new Set(extracted.map(f=>f.field+'\0'+f.sourceId));
            const old=(current.facts||[]).filter(f=>!pairs.has(f.field+'\0'+f.sourceId)&&sources.some(s=>s.id===f.sourceId&&s.text.includes(f.quote)));
            current.facts=[...new Map([...old,...extracted].map(f=>[JSON.stringify([f.field,f.sourceId,f.quote]),f])).values()];
            current.missing=FIELDS.filter(f=>!current.facts.some(x=>x.field===f));
            if(current.historical)current.review='needs-review';
            current.updatedAt=new Date().toISOString();
            this.assistant.save(current);job.created++;
          }catch{job.failed++;}
          finally{job.scanned++;}
        }
      }finally{job.state='done';this.running=false;}
    })();
    return job;
  }
  prepare(month,before=null){
    if(this.running)throw new CaseError('Já existe uma preparação de histórico em andamento.',409);
    if(before!==null&&(typeof before!=='string'||!/^20\d\d-\d\d-\d\d$/.test(before)||!before.startsWith(month+'-')))throw new CaseError('Limite de período inválido.');
    const local=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'});
    const input=this.unlinked(month).filter(r=>!isUncaptionedMedia(r)&&!r.quotedId&&!/\bR-[A-F0-9]{8}\b/i.test(r.text||'')&&!this.assistant.followup?.(r)?.review&&(!before||local.format(new Date(r.timestamp*1000))<before)).slice(0,72);
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
