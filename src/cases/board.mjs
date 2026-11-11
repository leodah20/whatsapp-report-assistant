import {randomUUID} from 'node:crypto';
import {seal,open} from '../core.mjs';

export const AREAS=['CFTV','SDAI','SCA','PABX','MEDICAO','BMS','ZABBIX'];
export const STATUSES={unconfirmed:'Andamento a confirmar',open:'Em atendimento',pending:'Aguardando providência',completed:'Concluído — confirmado manualmente'};
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
function text(value,max,required=false){if(typeof value!=='string'||value.length>max||value.includes('\0')||(required&&!value.trim()))throw new CaseError('Texto vazio ou acima do limite.');return value.trim();}
function day(value){
  if(typeof value!=='string'||!/^20\d\d-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T12:00:00Z'))||new Date(value+'T12:00:00Z').toISOString().slice(0,10)!==value||value>localDay())throw new CaseError('Informe uma data válida, não futura.');
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
    return {code:item.code,title:title.slice(0,180),summary:item.facts?.find(f=>f.field==='ocorrencia')?.quote||'',area:profile.area||suggestion.area,areaSuggested:!profile.area,candidates:suggestion.candidates,status:profile.status,version:profile.version,contextState:item.review==='clarification-received'?'analysis-pending':item.missing?.length?'needs-context':'complete',missing:item.missing||[],openTasks:profile.tasks.filter(t=>!t.resolvedAt).length,sourceCount:sources.length,answerCount:item.answerIds?.length||0,originMonth:item.month,activityMonths,firstSourceAt:timestamps[0]||null,lastSourceAt:timestamps.at(-1)||null,updatedAt:profile.events.at(-1)?.registeredAt||item.updatedAt||item.createdAt};
  }
  list(month,carry=false){
    if(!/^20\d\d-(0[1-9]|1[0-2])$/.test(month||''))throw new CaseError('Mês inválido.');
    const all=this.assistant.all().map(i=>this.summary(i));
    const items=all.filter(i=>i.activityMonths.includes(month)||(carry&&i.originMonth<month&&(i.status!=='completed'||i.openTasks>0))).map(i=>({...i,carryover:!i.activityMonths.includes(month)}));
    items.sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));
    return {untrusted:true,month,areas:AREAS,statuses:STATUSES,months:[...new Set([localDay().slice(0,7),...all.flatMap(i=>i.activityMonths)])].sort().reverse(),items};
  }
  detail(code){
    const item=this.item(code),profile=this.profile(item.id),sources=this.sources(item);
    const questionIds=[item.questionId,item.intakeMessageId].filter(Boolean);
    const notices=questionIds.map(this.readSource).filter(Boolean).map(s=>({...s,kind:s.id===item.questionId?'question':'receipt'}));
    const confirmations=(item.answerIds||[]).map(id=>this.assistant.receipts?.get(id)).filter(Boolean);
    return {untrusted:true,...this.summary(item,profile,sources),profile,facts:item.facts||[],questionState:item.questionState,sources:sources.map(s=>({...s,kind:(item.answerIds||[]).includes(s.id)?'answer':'source'})),notices,confirmations};
  }
  change(code,input){
    const item=this.item(code);
    if(!input||!Number.isInteger(input.version)||input.version<0)throw new CaseError('Versão inválida.');
    const allowed={profile:['version','kind','area','title','status','note','occurredOn'],note:['version','kind','text','occurredOn'],task:['version','kind','text','occurredOn'],resolve:['version','kind','taskId','text','occurredOn']};
    if(!Object.hasOwn(allowed,input.kind)||Object.keys(input).some(k=>!allowed[input.kind].includes(k)))throw new CaseError('Atualização inválida.');
    this.db.exec('BEGIN IMMEDIATE');
    try{
      const p=this.profile(item.id);
      if(p.version!==input.version)throw new CaseError('Este chamado foi atualizado em outra janela. Recarregue antes de salvar.',409);
      const event={id:randomUUID(),kind:input.kind,registeredAt:new Date().toISOString()};
      if(p.events.length>=2000)throw new CaseError('Limite de histórico atingido; preserve o arquivo e solicite revisão.');
      if(input.kind==='profile'){
        if(input.area!==null&&![...AREAS,'UNCLASSIFIED'].includes(input.area))throw new CaseError('Frente de serviço inválida.');
        if(!Object.hasOwn(STATUSES,input.status))throw new CaseError('Andamento inválido.');
        const note=text(input.note||'',2000,input.status!==p.status);
        if(input.status!==p.status)event.occurredOn=day(input.occurredOn);
        event.before={area:p.area,title:p.title,status:p.status};
        p.area=input.area;p.title=text(input.title,160);p.status=input.status;
        event.after={area:p.area,title:p.title,status:p.status};event.text=note;
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
}

export function imageType(data,mime){
  const b=Buffer.from(data);if(b.length>8*1024*1024)return null;
  if(mime==='image/jpeg'&&b[0]===255&&b[1]===216&&b[2]===255)return mime;
  if(mime==='image/png'&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return mime;
  if(mime==='image/webp'&&b.subarray(0,4).toString()==='RIFF'&&b.subarray(8,12).toString()==='WEBP')return mime;
  return null;
}
