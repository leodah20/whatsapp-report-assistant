export const STATUSES=Object.freeze({
  unconfirmed:'Etapa não identificada',open:'Em andamento',pending:'Aguardando',
  rescheduled:'Remarcado',cancelled:'Cancelado',completed:'Concluído'
});
export const stageQuestion='Qual é a etapa atual: em andamento, aguardando (o quê ou quem?), remarcado, cancelado ou concluído?';
export const isTerminal=status=>status==='completed'||status==='cancelled';
const plain=s=>s.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();

// Text is evidence only. Match explicit operational statements, not a diagnosis,
// a planned action, an isolated photo, or a historical mention of an outcome.
export function classifyStage(text){
  if(typeof text!=='string'||!text.trim())return null;
  const hits=new Map();
  for(const original of text.split(/\r?\n|[!?]+|\.(?:\s|$)|;|,?\s+mas\s+/iu)){
    const quote=original.trim().slice(0,450),s=plain(quote);
    if(!s||/\b(?:se|talvez|possivelmente|parece que|sera|seria|precisa (?:ser|confirmar)|a confirmar|sem confirmacao|anteriormente|na epoca|confirmar se)\s+.{0,36}\b(?:conclu|cancel|remarc|normaliz|voltou)/.test(s)||/\b(?:nao|ainda nao|nem)\s+(?:(?:foi|esta|ficou|voltou|houve)\s+)?(?:conclu|cancel|remarc|normaliz|funcion|restabelec|voltou)/.test(s))continue;
    if(/\b(?:cancelamento (?:solicitado|previsto)|solicit\w* (?:o )?cancelamento|pedido de cancelamento|nao (?:estamos|esta|estao|segue) aguardando)\b/.test(s))continue;
    let stage;
    if(/\b(?:remarcad[oa]|reagendad[oa])\b/.test(s)&&!/\b(?:tentar|precisa|solicit\w*|vai ser|deve ser)\b/.test(s))stage='rescheduled';
    else if(/^(?:(?:status|etapa)\s*:\s*)?cancelad[oa](?:\s*[,.: -]?$|\s+(?:por|porque|a pedido)\b)|\b(?:chamado|atendimento|servico|vistoria|intervencao|visita)\s+(?:(?:foi|esta)\s+)?cancelad[oa]\b/.test(s))stage='cancelled';
    else if(/^(?:(?:status|etapa)\s*:\s*)?aguardando\s*[: -]?$/.test(s))stage='unconfirmed';
    else if(/\bpendencia\s*:|\b(?:aguard(?:ando|amos)|em espera|depende de|pendente de|(?:precisamos|vamos precisar)\s+(?:de|que)|encaminhad[oa] (?:para|a|ao))\b/.test(s))stage='pending';
    else if(/^(?:(?:status|etapa)\s*:\s*)?concluid[oa]$|\b(?:chamado|atendimento|servico|manutencao)\s+(?:(?:foi|esta)\s+)?concluid[oa]\b|\b(?:voltou a (?:operar|funcionar)|retomou a operacao|funcionando normalmente|operando normalmente|normalizou|(?:operacao|funcionamento|acesso|sistema)\s+restabelecid[oa])\b/.test(s)&&!/\b(?:parcial\w*|temporari\w*|intermit\w*|falhou|persist\w*|antes|apos\s+.*\b(?:vai|sera))\b/.test(s))stage='completed';
    else if(/\b(?:em andamento|em atendimento|em execucao|em fase de (?:instalacao|teste|execucao)|trabalhando no chamado|iniciamos (?:o atendimento|os testes)|(?:equipe|tecnico) (?:ja )?esta (?:no local|atuando))\b/.test(s))stage='open';
    if(stage)hits.set(stage,quote);
  }
  if(hits.size>1){
    // Active work can pause for a dependency or be rescheduled; other
    // contradictions in one record need a person to resolve them.
    if(hits.has('open')&&(hits.has('pending')||hits.has('rescheduled')))hits.delete('open');
    if(hits.size!==1)return {status:'unconfirmed',reason:'Há etapas conflitantes no mesmo registro.'};
  }
  const [status,reason]=hits.entries().next().value||[];
  return status?{status,reason}:null;
}

export function reportFieldConfirmedAt(profile,field){
  const event=profile.events?.findLast(e=>e.kind==='context'&&
    (Array.isArray(e.reportFieldsChanged)?e.reportFieldsChanged.includes(field):e.resultChanged!==false));
  return Date.parse(event?.registeredAt)||0;
}

export function currentStage(profile={},sources=[]){
  if(profile.status&&profile.status!=='unconfirmed'){
    const event=profile.events?.findLast(e=>e.after?.status===profile.status&&e.before?.status!==e.after?.status);
    return {status:profile.status,reason:profile.stageReason||event?.text||'',scheduledFor:profile.scheduledFor||null,origin:'manual'};
  }
  const dependency=profile.tasks?.findLast(t=>!t.resolvedAt);
  const records=sources.filter(s=>Number.isFinite(s.timestamp)&&s.text?.trim()&&!s.manualPhoto).map(s=>({at:s.timestamp*1000,text:s.text,origin:'source'}));
  for(const event of profile.events||[])if(event.kind==='note'&&event.text)records.push({at:Date.parse(event.registeredAt),text:event.text,origin:'note'});
  if(profile.answers?.resultado){
    const result=profile.answers.resultado,procedure=profile.answers.procedimento;
    const linked=typeof procedure==='string'&&/\babortad[oa]\b/.test(plain(result))&&classifyStage(procedure)?.status==='pending';
    const confirmedAt=reportFieldConfirmedAt(profile,'resultado');
    records.push({at:linked?Math.max(confirmedAt,reportFieldConfirmedAt(profile,'procedimento')):confirmedAt,text:linked?result+'\n'+procedure:result,origin:'context'});
  }
  if(dependency)records.push({at:Date.parse(dependency.registeredAt)||0,text:dependency.text,origin:'task'});
  records.sort((a,b)=>b.at-a.at);
  for(const record of records){
    const inferred=record.origin==='task'?{status:'pending',reason:record.text}:classifyStage(record.text);
    if(inferred){
      if(inferred.status==='completed'&&dependency)return {status:'pending',reason:dependency.text,origin:'task'};
      return {...inferred,origin:record.origin,...(record.at>0?{at:record.at}:{})};
    }
    // A newer aborted visit or renewed fault must not look like a previous closure.
    const raw=plain(record.text);
    if(/\b(?:abortad[oa]|voltou a falhar|falhou novamente|parou (?:de novo|novamente)|problema retornou|permanece inoperante|continua (?:inoperante|com falha)|nao (?:foi concluido|voltou a operar|voltou a funcionar))\b/.test(raw)){
      for(const older of records.filter(r=>r.at<=record.at&&r!==record)){
        if(older.origin==='task')return {status:'pending',reason:older.text,origin:'task'};
        if(record.at-older.at>7*86400000||!/\babortad[oa]\b/.test(raw))break;
        const evidence=classifyStage(older.text);
        if(evidence)return evidence.status==='pending'?{...evidence,origin:older.origin}:unknown();
      }
      return unknown();
    }
  }
  return unknown();
}
function unknown(){return {status:'unconfirmed',reason:'Os registros não indicam a etapa atual.',origin:'unknown'};}
