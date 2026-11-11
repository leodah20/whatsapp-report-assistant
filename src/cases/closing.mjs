import {createHash} from 'node:crypto';
import {CaseError,localDay,STATUSES} from './board.mjs';
import {open,seal} from '../core.mjs';
import {reportAttachmentPath} from './report-archive.mjs';

const monthPattern=/^20\d\d-(0[1-9]|1[0-2])$/;
const codePattern=/^R-[A-F0-9]{8}$/;
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const clean=(s,max)=>{if(typeof s!=='string'||s.length>max||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(s))throw new CaseError('Texto inválido ou acima do limite.');return s.trim();};
function date(s){
  if(typeof s!=='string'||!/^20\d\d-\d\d-\d\d$/.test(s)||!Number.isFinite(Date.parse(s))||new Date(s).toISOString().slice(0,10)!==s||s>localDay())throw new CaseError('Confirme uma data real, válida e não futura.');
  return s;
}
const photo=s=>s.mediaState==='saved'&&/^image\/(jpeg|png|webp)(;|$)/.test(s.mime||'');
const stamp=d=>digest([d.profile.version,d.contextState,d.facts,d.sources.map(s=>[s.id,s.text,s.timestamp,s.mediaState,s.mime])]);
const shape=(obj,keys)=>{if(!obj||typeof obj!=='object'||Array.isArray(obj)||Object.keys(obj).some(k=>!keys.includes(k)))throw new CaseError('Campos de revisão inválidos.');};
const states=['done','pending','unknown','na'];

export class MonthlyClosing{
  constructor({db,key,board,template,archive=()=>({count:0,revision:''}),unlinkedCount=()=>0}){
    Object.assign(this,{db,key,board,template,archive,unlinkedCount});
    db.exec('CREATE TABLE IF NOT EXISTS monthly_closings (month TEXT PRIMARY KEY, payload BLOB NOT NULL)');
  }
  load(month){
    if(!monthPattern.test(month||''))throw new CaseError('Competência inválida.');
    const row=this.db.prepare('SELECT payload FROM monthly_closings WHERE month=?').get(month);
    const data=row?JSON.parse(open(this.key,row.payload,'closing:'+month)):{version:0,reviews:{},settings:null};
    data.sourceReviews??={};return data;
  }
  candidates(month){
    return this.board.list(month,true).items.map(i=>({...i,stageLabel:STATUSES[i.status],stamp:stamp(this.board.detail(i.code))}));
  }
  get(month){
    const data=this.load(month), template=this.template(), items=this.candidates(month);
    const archive=this.archive(month);
    const coverage=digest([archive.revision,items.map(i=>[i.code,i.stamp]).sort((a,b)=>a[0].localeCompare(b[0]))]);
    const checks=[];
    if(!template)checks.push('O modelo local de impressão não está configurado.');
    if(!data.settings||data.settings.coverage!==coverage)checks.push('Você conferiu se as fontes do período e os chamados anteriores estão representados?');
    const templateStamp=template?digest(template):null;
    const currentStatuses=templateStamp&&data.settings?.template===templateStamp&&Array.isArray(data.settings.statuses)?data.settings.statuses:null;
    if(template&&(!currentStatuses||currentStatuses.length!==template.groups.flatMap(g=>g.rows).length||currentStatuses.some(s=>!states.includes(s))))checks.push('Confirme os status das tabelas preventivas.');
    if(template&&!data.settings?.issued)checks.push('Informe a data de emissão para imprimir.');
    const rows=items.map(i=>{
      const review=data.reviews[i.code]||null;
      const state=!review?'unreviewed':review.stamp!==i.stamp?'stale':review.decision;
      const sourceReview=data.sourceReviews[i.code]||null;
      return {...i,state,review,sourceReview,sourceReviewState:!sourceReview?'unreviewed':sourceReview.stamp===i.stamp?'reviewed':'stale'};
    });
    if(rows.some(i=>!['include','exclude'].includes(i.state)))checks.push('Revise os chamados não decididos ou que receberam novas informações.');
    return {month,version:data.version,settings:data.settings?{...data.settings,statuses:currentStatuses||[]}:null,items:rows,checks,coverage,archiveCount:archive.count,unlinkedCount:this.unlinkedCount(month),template:template?{name:template.name,groups:template.groups,stamp:templateStamp}:null};
  }
  save(month,input){
    const data=this.load(month);
    if(input?.version!==data.version)throw new CaseError('A revisão mudou. Recarregue antes de salvar.',409);
    if(input.kind==='sources'){
      shape(input,['kind','version','code','stamp','attachments']);
      if(!codePattern.test(input.code||''))throw new CaseError('Chamado inválido.');
      const entry=this.candidates(month).find(i=>i.code===input.code);
      if(!entry||entry.stamp!==input.stamp)throw new CaseError('As fontes mudaram. Recarregue e revise.',409);
      const sources=this.board.detail(input.code).sources;
      if(!Array.isArray(input.attachments)||input.attachments.length>100||new Set(input.attachments).size!==input.attachments.length||input.attachments.some(n=>!Number.isInteger(n)||!sources[n]?.hasMedia||sources[n].mediaState!=='saved'))throw new CaseError('Selecione apenas anexos arquivados deste chamado.');
      data.sourceReviews[input.code]={stamp:entry.stamp,attachments:input.attachments,at:new Date().toISOString()};
    }else if(input.kind==='settings'||input.kind==='preventives'){
      const onlyStatuses=input.kind==='preventives';
      shape(input,onlyStatuses?['kind','version','templateStamp','statuses']:['kind','version','issued','statuses','observations','coverage']);
      const template=this.template();
      if(!template)throw new CaseError('Modelo local não configurado.');
      const templateStamp=digest(template);
      if(onlyStatuses&&input.templateStamp!==templateStamp)throw new CaseError('O modelo de preventivas mudou. Recarregue o fechamento.',409);
      const groups=template.groups.flatMap(g=>g.rows);
      if(!Array.isArray(input.statuses)||input.statuses.length!==groups.length||input.statuses.some(s=>!states.includes(s)&&!(onlyStatuses&&s==='')))throw new CaseError('Informe um status válido para as preventivas.');
      if(onlyStatuses){
        data.settings={issued:null,observations:'',coverage:null,...data.settings,statuses:input.statuses,template:templateStamp};
      }else{
        const current=this.get(month);
        if(input.coverage&&input.coverage!==current.coverage)throw new CaseError('Há mudanças na lista de chamados. Recarregue e confira a cobertura.',409);
        const issued=date(input.issued);
        if(issued.slice(0,7)<month)throw new CaseError('A emissão não pode ser anterior à competência.');
        data.settings={issued,statuses:input.statuses,observations:clean(input.observations,2500),coverage:input.coverage||null,template:templateStamp};
      }
    }else{
      shape(input,['kind','version','code','stamp','decision','reason','title','start','end','historical','narrative','photos','verified']);
      if(input.kind!=='review'||!codePattern.test(input.code||'')||!['include','exclude','defer'].includes(input.decision))throw new CaseError('Decisão inválida.');
      const entry=this.candidates(month).find(i=>i.code===input.code);
      if(!entry||entry.stamp!==input.stamp)throw new CaseError('As fontes do chamado mudaram. Recarregue e revise.',409);
      const review={decision:input.decision,stamp:entry.stamp,at:new Date().toISOString()};
      if(input.decision==='include'){
        const title=clean(input.title,180),narrative=clean(input.narrative,3400);
        if(!title||!narrative||input.verified!==true)throw new CaseError('Confirme título e texto, incluindo o desfecho observado ou a pendência.');
        const historical=input.historical===true;
        if(historical&&(input.start||input.end))throw new CaseError('Acompanhamento sem nova intervenção não recebe data de atendimento.');
        const start=historical?null:date(input.start),end=input.end?date(input.end):null;
        if(start&&(start.slice(0,7)!==month||(end&&(end<start||end.slice(0,7)!==month))))throw new CaseError('Confirme a data ou período dentro da competência selecionada.');
        const sources=this.board.detail(input.code).sources;
        if(!Array.isArray(input.photos)||input.photos.length>6||new Set(input.photos).size!==input.photos.length||input.photos.some(n=>!Number.isInteger(n)||!sources[n]||!photo(sources[n])))throw new CaseError('Selecione apenas imagens arquivadas do próprio chamado.');
        Object.assign(review,{title,narrative,start,end,historical,photos:input.photos});
      }else{
        review.reason=clean(input.reason,1000);
        if(!review.reason)throw new CaseError('Registre o motivo da exclusão ou a pergunta que falta responder.');
      }
      data.reviews[input.code]=review;
    }
    data.version++;
    this.db.prepare('INSERT INTO monthly_closings VALUES(?,?) ON CONFLICT(month) DO UPDATE SET payload=excluded.payload').run(month,seal(this.key,Buffer.from(JSON.stringify(data)),'closing:'+month));
    return this.get(month);
  }
  draft(month){
    const view=this.get(month);
    if(view.checks.length)throw new CaseError('Minuta ainda não liberada: '+view.checks.join(' '),409);
    const template=this.template();
    const items=view.items.filter(i=>i.state==='include').map(i=>({code:i.code,...i.review})).sort((a,b)=>(a.start||'9999').localeCompare(b.start||'9999')||a.code.localeCompare(b.code));
    return {month,version:view.version,name:template.name,footer:template.footer,groups:template.groups,settings:view.settings,items};
  }
  contextPackage(month,codes){
    if(!Array.isArray(codes)||!codes.length||codes.length>100||new Set(codes).size!==codes.length||codes.some(c=>typeof c!=='string'||!codePattern.test(c)))throw new CaseError('Selecione de 1 a 100 chamados distintos.');
    const view=this.get(month);
    const allowed=new Map(view.items.filter(i=>i.state!=='exclude').map(i=>[i.code,i]));
    const cases=codes.map(code=>{
      const row=allowed.get(code);
      if(!row)throw new CaseError('Há chamados excluídos ou fora da competência. Recarregue a seleção.',409);
      const d=this.board.detail(code),review=row.state==='include'?row.review:null;
      const reviewedAttachments=row.sourceReviewState==='reviewed'?new Set(row.sourceReview.attachments):new Set();
      const sources=d.sources.map((s,n)=>({ref:n+1,recordedAt:s.timestamp?new Date(s.timestamp*1000).toISOString():null,
        kind:s.kind,text:s.text||'',media:s.hasMedia?{state:s.mediaState,type:s.mime||s.type,
          path:reviewedAttachments.has(n)?reportAttachmentPath(code,n+1,s.mime||s.type):null,selectedForPrint:!!review?.photos.includes(n)}:null}));
      return {code,area:d.area,title:review?.title||d.title,location:d.location||null,locationConfirmed:d.locationConfirmed,
        serviceDate:review?.historical?null:(review?.start||d.serviceDay||null),endDate:review?.end||null,historical:!!review?.historical,
        fromEarlierMonth:row.carryover,stage:{label:row.stageLabel,origin:d.stage?.origin,reason:d.stage?.reason||'',scheduledFor:d.stage?.scheduledFor||null},
        sourceReviewState:row.sourceReviewState,reviewState:row.state,reviewedText:review?.narrative||null,question:row.state==='defer'?row.review.reason:null,
        stageQuestion:d.stageQuestion||null,missing:d.missing,facts:d.facts.map(f=>({field:f.field,text:f.quote,confirmed:!!f.confirmed})),
        tasks:d.profile.tasks.filter(t=>!t.resolvedAt).map(t=>t.text),
        updates:d.profile.events.filter(e=>['note','profile','context','task','resolve'].includes(e.kind)&&e.text).map(e=>({kind:e.kind,serviceDate:e.occurredOn||null,registeredAt:e.registeredAt,text:e.text})),
        sources};
    });
    const settings=view.settings,preventiveStatuses=settings?.statuses||[];
    let offset=0;
    const preventive=view.template?.groups.map(g=>({name:g.name,rows:g.rows.map(([week,task,category])=>({week,task,category,status:preventiveStatuses[offset++]||null}))}))||[];
    const output={schemaVersion:1,month,preparedAt:new Date().toISOString(),coverageConfirmed:!!settings&&settings.coverage===view.coverage,
      checks:view.checks,unlinkedCount:view.unlinkedCount,project:view.template?.name||null,issued:settings?.issued||null,observations:settings?.observations||null,preventive,cases};
    if(Buffer.byteLength(JSON.stringify(output))>2*1024*1024)throw new CaseError('A extração excede 2 MB de texto. Exporte os chamados em grupos menores.',413);
    return output;
  }
}
