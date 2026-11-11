import {randomUUID} from 'node:crypto';
import {seal,open} from '../core.mjs';
import {currentStage,isTerminal,stageQuestion,STATUSES} from './stage.mjs';
export {STATUSES} from './stage.mjs';

export const AREAS=['CFTV','SDAI','SCA','PABX','MEDICAO','BMS','ZABBIX'];
export const FIELD_LABELS={local:'Local',equipamento:'Equipamento',ocorrencia:'Ocorrência',procedimento:'Procedimento',resultado:'Resultado / pendência'};
export class CaseError extends Error {constructor(message,status=400){super(message);this.status=status;}}
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const rules={
  CFTV:/\b(cftv|cameras?|nvr|dvr|dss)\b/,
  SDAI:/\b(sdai|simplex|detectores?|deteccao|chaves? de fluxo|lacos?|alarme de incendio)\b/,
  SCA:/\b(sca|invenzi|w-access|controle de acesso|controladoras?|eletroimas?|quebra vidro|facial|catracas?)\b/,
  PABX:/\b(pabx|interfonia|interfones?|intercomunicador|ramal|ramais)\b/,
  MEDICAO:/\b(medicao|medidores?|hidrometros?|consumo|akvometer|kron|ikron)\b/,
  BMS:/\b(bms|bacnet|modbus|automacao|mrb|mci|mcis)\b/,
  ZABBIX:/\bzabbix\b/
};
export function suggestArea(text){
  const candidates=AREAS.filter(a=>rules[a].test(normalize(text)));
  return {area:candidates.length===1?candidates[0]:'UNCLASSIFIED',candidates};
}
export function localDay(value=new Date()){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));
  return ['year','month','day'].map(t=>parts.find(p=>p.type===t).value).join('-');
}
const blank=()=>({version:0,area:null,title:'',status:'unconfirmed',events:[],tasks:[]});
function literalLocation(quote){
  const s=quote.trim();
  const places=s.match(/\b(?:\d{1,3}\s*[º°ª]?\s*(?:pavimento|andar)|(?:pavimento|andar|unidade|loja|conjunto)\s+\d{1,5}[º°ª]?|\d{1,2}\s*[º°ª]?\s*sub[- ]?solo)\b/gi);
  if(places?.length===1&&s.length>places[0].length+18)return places[0];
  if(s.length<=100&&/\b(pavimento|andar|torre|setor|unidade|loja|conjunto|subsolo|hotel|residencial|corporativo|térreo|recepção|portaria|cco|cpd)\b/i.test(s)&&!/[.!?]/.test(s))return s;
  return '';
}
function text(value,max,required=false){if(typeof value!=='string'||value.length>max||value.includes('\0')||(required&&!value.trim()))throw new CaseError('Texto vazio ou acima do limite.');return value.trim();}
function day(value,allowFuture=false){
  if(typeof value!=='string'||!/^20\d\d-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T12:00:00Z'))||new Date(value+'T12:00:00Z').toISOString().slice(0,10)!==value||(!allowFuture&&value>localDay()))throw new CaseError(allowFuture?'Informe uma data de remarcação válida.':'Informe uma data válida, não futura.');
  return value;
}
export class CaseBoard{
  constructor({db,key,assistant,readSource}){Object.assign(this,{db,key,assistant,readSource});db.exec('CREATE TABLE IF NOT EXISTS case_profiles (case_id TEXT PRIMARY KEY, version INTEGER NOT NULL, payload BLOB NOT NULL)');}
  item(code){if(typeof code!=='string'||!/^R-[A-F0-9]{8}$/.test(code))throw new CaseError('Chamado não encontrado.',404);const item=this.assistant.all().find(i=>i.code===code);if(!item)throw new CaseError('Chamado não encontrado.',404);return item;}
  profile(id){const row=this.db.prepare('SELECT version,payload FROM case_profiles WHERE case_id=?').get(id);if(!row)return blank();return {...JSON.parse(open(this.key,row.payload,'case-profile:'+id)),version:row.version};}
  sources(item){return [...new Set(item.sourceIds||[])].map(this.readSource).filter(Boolean);}
  summary(item,profile=this.profile(item.id),sources=this.sources(item)){
    const suggestion=suggestArea([...(item.facts||[]).map(f=>f.quote),...sources.map(s=>s.text)].join('\n'));
    const activityMonths=[...new Set([item.month,...sources.map(s=>s.month),...profile.events.filter(e=>e.occurredOn).map(e=>e.occurredOn.slice(0,7))])].filter(m=>/^20\d\d-(0[1-9]|1[0-2])$/.test(m)).sort();
    const title=profile.title||item.facts?.find(f=>f.field==='equipamento')?.quote||item.facts?.find(f=>f.field==='ocorrencia')?.quote||'Registro aguardando descrição';
    const timestamps=sources.map(s=>s.timestamp).filter(Number.isFinite).sort((a,b)=>a-b);
    const literalLocations=[...new Set((item.facts||[]).filter(f=>f.field==='local').map(f=>literalLocation(f.quote)).filter(Boolean))];
    const location=profile.location||(literalLocations.length===1?literalLocations[0]:'');
    const referenceAt=timestamps[0]??(Number.isFinite(Date.parse(item.createdAt))?Date.parse(item.createdAt)/1000:null);
    const confirmed=profile.answers||{};
    const missing=[...new Set([...(item.missing||[]),...(profile.location?[]:['local'])])].filter(f=>f==='local'?!profile.location:!confirmed[f]);
    const stage=currentStage(profile,sources);
    return {code:item.code,title:title.slice(0,180),location,locationConfirmed:!!profile.location,serviceDay:profile.serviceDay||null,referenceAt,referenceKind:timestamps.length?'source':'created',summary:confirmed.ocorrencia||item.facts?.find(f=>f.field==='ocorrencia')?.quote||'',area:profile.area||suggestion.area,areaSuggested:!profile.area,candidates:suggestion.candidates,status:stage.status,stage,version:profile.version,contextState:missing.length?(item.review==='clarification-received'?'analysis-pending':'needs-context'):'complete',missing,openTasks:profile.tasks.filter(t=>!t.resolvedAt).length,sourceCount:sources.length,answerCount:item.answerIds?.length||0,originMonth:item.month,activityMonths,firstSourceAt:timestamps[0]||null,lastSourceAt:timestamps.at(-1)||null,updatedAt:[profile.events.at(-1)?.registeredAt,item.updatedAt,item.createdAt].filter(Boolean).sort().at(-1)};
  }
  list(month,carry=false,includeArchived=false){
    if(!/^20\d\d-(0[1-9]|1[0-2])$/.test(month||''))throw new CaseError('Mês inválido.');
    const all=this.assistant.all().map(i=>{const p=this.profile(i.id);return {...this.summary(i,p),archived:!!p.archived,historical:!!i.historical};}).filter(i=>includeArchived||!i.archived);
    const items=all.filter(i=>i.activityMonths.includes(month)||(carry&&i.originMonth<month&&(!isTerminal(i.status)||i.openTasks>0))).map(i=>({...i,carryover:!i.activityMonths.includes(month)}));
    items.sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));
    return {untrusted:true,month,areas:AREAS,statuses:STATUSES,months:[...new Set([localDay().slice(0,7),...all.flatMap(i=>i.activityMonths)])].sort().reverse(),items};
  }
  detail(code){
    const item=this.item(code),profile=this.profile(item.id),sources=this.sources(item);
    const questionIds=[item.questionId,item.intakeMessageId].filter(Boolean);
    const notices=questionIds.map(this.readSource).filter(Boolean).map(s=>({...s,kind:s.id===item.questionId?'question':'receipt'}));
    const confirmations=(item.answerIds||[]).map(id=>this.assistant.receipts?.get(id)).filter(Boolean);
    const confirmed={...(profile.answers||{}),...(profile.location?{local:profile.location}:{})};
    const facts=[...Object.entries(confirmed).map(([field,quote])=>({field,quote,confirmed:true})),...(item.facts||[]).filter(f=>!confirmed[f.field])];
    const summary=this.summary(item,profile,sources);
    return {untrusted:true,...summary,profile,stageQuestion:summary.status==='unconfirmed'?stageQuestion:null,facts,questionState:item.questionState,sources:sources.map(s=>({...s,kind:s.manualPhoto?'manual-photo':(item.answerIds||[]).includes(s.id)?'answer':'source'})),notices,confirmations};
  }
  change(code,input){
    if(input?.kind==='merge'){
      if(Object.keys(input).some(k=>!['kind','version','duplicate'].includes(k)))throw new CaseError('Mesclagem inválida.');
      return this.merge(code,input.duplicate,input.version);
    }
    const item=this.item(code);
    if(!input||!Number.isInteger(input.version)||input.version<0)throw new CaseError('Versão inválida.');
    const allowed={profile:['version','kind','area','title','status','note','occurredOn','location','serviceDay'],context:['version','kind','location','serviceDay','answers','stage'],note:['version','kind','text','occurredOn'],task:['version','kind','text','occurredOn'],resolve:['version','kind','taskId','text','occurredOn'],archive:['version','kind','text'],restore:['version','kind']};
    if(!Object.hasOwn(allowed,input.kind)||Object.keys(input).some(k=>!allowed[input.kind].includes(k)))throw new CaseError('Atualização inválida.');
    this.db.exec('BEGIN IMMEDIATE');
    try{
      const p=this.profile(item.id);
      if(p.version!==input.version)throw new CaseError('Este chamado foi atualizado em outra janela. Recarregue antes de salvar.',409);
      const event={id:randomUUID(),kind:input.kind,registeredAt:new Date().toISOString()};
      if(p.events.length>=2000)throw new CaseError('Limite de histórico atingido; preserve o arquivo e solicite revisão.');
      if(input.kind==='context'){
        const keys=['equipamento','ocorrencia','procedimento','resultado'];
        if(!input.answers||typeof input.answers!=='object'||Array.isArray(input.answers)||Object.keys(input.answers).some(k=>!keys.includes(k)))throw new CaseError('Respostas inválidas.');
        p.location=text(input.location,150);
        p.serviceDay=input.serviceDay?day(input.serviceDay):null;
        const answers=Object.fromEntries(keys.map(k=>[k,text(input.answers[k]??'',1000)]).filter(([,v])=>v));
        event.resultChanged=p.answers?.resultado!==answers.resultado||p.answers?.procedimento!==answers.procedimento;
        p.answers=answers;
        event.text='Contexto revisado no painel.';
        if(Object.hasOwn(input,'stage')){
          const stage=input.stage;
          if(!stage||Array.isArray(stage)||typeof stage!=='object'||Object.keys(stage).some(k=>!['status','reason','scheduledFor'].includes(k))||!Object.hasOwn(STATUSES,stage.status))throw new CaseError('Etapa inválida.');
          if(stage.scheduledFor&&stage.status!=='rescheduled')throw new CaseError('A nova data só se aplica a chamados remarcados.');
          const reason=stage.status==='unconfirmed'?'':text(stage.reason??'',500,['pending','cancelled','rescheduled','completed'].includes(stage.status));
          event.before={status:p.status};event.after={status:stage.status};
          p.status=stage.status;p.stageReason=reason;p.scheduledFor=stage.scheduledFor?day(stage.scheduledFor,true):null;
          event.text=(stage.status==='unconfirmed'?'Etapa definida pelas fontes.':STATUSES[stage.status]+(reason?' — '+reason:'')+(p.scheduledFor?' · nova data: '+p.scheduledFor:''))+'. Contexto revisado no painel.';
        }
      }else if(input.kind==='archive'){
        if(p.archived)throw new CaseError('Chamado já arquivado.',409);
        event.text=text(input.text,1000,true);
        p.archived={at:event.registeredAt,reason:event.text};
      }else if(input.kind==='restore'){
        if(!p.archived)throw new CaseError('Chamado já está ativo.',409);
        if(item.mergedInto)throw new CaseError('Este duplicado foi reunido ao chamado principal e não pode ser restaurado como separado.',409);
        p.archived=null;
      }else if(input.kind==='profile'){
        if(input.area!==null&&![...AREAS,'UNCLASSIFIED'].includes(input.area))throw new CaseError('Frente de serviço inválida.');
        if(!Object.hasOwn(STATUSES,input.status))throw new CaseError('Andamento inválido.');
        const note=text(input.note||'',2000,input.status!==p.status);
        if(input.status!==p.status)event.occurredOn=day(input.occurredOn);
        event.before={area:p.area,title:p.title,status:p.status,location:p.location||'',serviceDay:p.serviceDay||null};
        p.area=input.area;p.title=text(input.title,160);
        if(input.status!==p.status){p.stageReason=input.status==='unconfirmed'?'':note;p.scheduledFor=null;}
        p.status=input.status;
        if(Object.hasOwn(input,'location'))p.location=text(input.location,150);
        if(Object.hasOwn(input,'serviceDay'))p.serviceDay=input.serviceDay===null||input.serviceDay===''?null:day(input.serviceDay);
        event.after={area:p.area,title:p.title,status:p.status,location:p.location||'',serviceDay:p.serviceDay||null};event.text=note;
      }else{
        event.occurredOn=day(input.occurredOn);event.text=text(input.text,input.kind==='task'?500:2000,true);
        if(input.kind==='task'){
          if(p.tasks.filter(t=>!t.resolvedAt).length>=100)throw new CaseError('Limite de pendências abertas atingido.');
          p.tasks.push({id:event.id,text:event.text,occurredOn:event.occurredOn,registeredAt:event.registeredAt});
        }
        if(input.kind==='resolve'){
          const task=p.tasks.find(t=>t.id===input.taskId);if(!task||task.resolvedAt)throw new CaseError('Pendência não encontrada ou já concluída.');
          if(event.occurredOn<task.occurredOn)throw new CaseError('A conclusão não pode ser anterior à pendência.');
          task.resolvedAt=event.registeredAt;task.resolvedOn=event.occurredOn;task.resolution=event.text;event.taskId=task.id;event.taskText=task.text;
        }
      }
      p.events.push(event);p.version++;
      this.db.prepare('INSERT INTO case_profiles VALUES(?,?,?) ON CONFLICT(case_id) DO UPDATE SET version=excluded.version,payload=excluded.payload').run(item.id,p.version,seal(this.key,Buffer.from(JSON.stringify(p)),'case-profile:'+item.id));
      this.db.exec('COMMIT');
    }catch(e){this.db.exec('ROLLBACK');throw e;}
    return this.detail(code);
  }
  addPhoto(code,bytes,mime){
    const item=this.item(code);
    if(this.profile(item.id).archived)throw new CaseError('Restaure o chamado antes de anexar.',409);
    if(bytes.length>5*1024*1024||!imageType(bytes,mime))throw new CaseError('Envie uma foto JPEG, PNG ou WebP de até 5 MB.');
    if(this.sources(item).filter(s=>s.manualPhoto).length>=24)throw new CaseError('Limite de fotos adicionadas pelo painel.');
    const id='manual-photo:'+randomUUID(),timestamp=Math.floor(Date.now()/1000);
    const record={id,timestamp,month:item.month,text:'',type:'image',manualPhoto:true,hasMedia:true,mediaState:'saved',mime};
    this.db.exec('BEGIN IMMEDIATE');
    try{
      this.db.prepare('INSERT INTO messages (id,month,ts,payload,media) VALUES(?,?,?,?,?)').run(id,item.month,timestamp,seal(this.key,Buffer.from(JSON.stringify(record)),id),seal(this.key,bytes,id+':media'));
      this.db.prepare('INSERT INTO assistant_links VALUES (?,?)').run(id,item.id);
      item.sourceIds=[...item.sourceIds,id];item.updatedAt=new Date().toISOString();this.assistant.save(item);
      this.db.exec('COMMIT');
    }catch(e){this.db.exec('ROLLBACK');throw e;}
    return this.detail(code);
  }
  merge(code,duplicateCode,version){
    const main=this.item(code),duplicate=this.item(duplicateCode);
    if(main.id===duplicate.id)throw new CaseError('Escolha outro chamado.');
    this.db.exec('BEGIN IMMEDIATE');
    try{
      const p=this.profile(main.id),q=this.profile(duplicate.id);
      if(p.version!==version)throw new CaseError('O chamado mudou. Recarregue antes de reunir.',409);
      if(p.archived||duplicate.mergedInto)throw new CaseError('Escolha um principal ativo e um duplicado ainda não reunido.',409);
      const now=new Date().toISOString(),event=(text)=>({id:randomUUID(),kind:'merge',registeredAt:now,text});
      p.events.push(event('Fontes reunidas do chamado '+duplicate.code+'. O histórico original permanece arquivado.'));
      q.events.push(event('Reunido ao chamado '+main.code+'.'));
      p.tasks=[...p.tasks,...q.tasks.filter(t=>!p.tasks.some(x=>x.id===t.id))];
      p.answers={...(q.answers||{}),...(p.answers||{})};
      if(!p.location&&q.location)p.location=q.location;
      q.archived={at:now,reason:'Reunido ao chamado '+main.code};
      main.sourceIds=[...new Set([...main.sourceIds,...duplicate.sourceIds])].sort((a,b)=>(this.readSource(a)?.timestamp||0)-(this.readSource(b)?.timestamp||0));
      main.answerIds=[...new Set([...(main.answerIds||[]),...(duplicate.answerIds||[])])];
      main.facts=[...(main.facts||[]),...(duplicate.facts||[])];
      main.missing=['local','equipamento','ocorrencia','procedimento','resultado'].filter(f=>!main.facts.some(x=>x.field===f));
      main.updatedAt=now;duplicate.mergedInto=main.id;duplicate.updatedAt=now;
      this.assistant.save(main);this.assistant.save(duplicate);
      this.db.prepare('UPDATE assistant_links SET item_id=? WHERE item_id=?').run(main.id,duplicate.id);
      const put=this.db.prepare('INSERT INTO case_profiles VALUES(?,?,?) ON CONFLICT(case_id) DO UPDATE SET version=excluded.version,payload=excluded.payload');
      for(const [id,profile] of [[main.id,p],[duplicate.id,q]]){profile.version++;put.run(id,profile.version,seal(this.key,Buffer.from(JSON.stringify(profile)),'case-profile:'+id));}
      this.db.exec('COMMIT');
    }catch(e){this.db.exec('ROLLBACK');throw e;}
    return this.detail(code);
  }
}

export function imageType(data,mime){
  const b=Buffer.from(data);if(b.length>8*1024*1024)return null;
  if(mime==='image/jpeg'&&b[0]===255&&b[1]===216&&b[2]===255)return mime;
  if(mime==='image/png'&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return mime;
  if(mime==='image/webp'&&b.subarray(0,4).toString()==='RIFF'&&b.subarray(8,12).toString()==='WEBP')return mime;
  return null;
}
