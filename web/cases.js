'use strict';
const $=id=>document.getElementById(id);
const labels={ALL:'Todas as frentes',CFTV:'CFTV',SDAI:'SDAI',SCA:'SCA',PABX:'PABX',MEDICAO:'Medição',BMS:'BMS',ZABBIX:'Zabbix',UNCLASSIFIED:'Sem classificação'};
const fields={local:'Local',equipamento:'Equipamento',ocorrencia:'Ocorrência',procedimento:'Procedimento',resultado:'Resultado / pendência'};
const kinds={source:'Registro do WhatsApp',answer:'Resposta do WhatsApp',question:'Pergunta do assistente',receipt:'Confirmação de registro',note:'Atualização local',task:'Pendência registrada',resolve:'Pendência concluída',profile:'Cadastro atualizado',context:'Respostas confirmadas',merge:'Chamados reunidos',archive:'Arquivado',restore:'Restaurado','manual-photo':'Foto adicionada pelo painel'};
const tz='America/Sao_Paulo';
const day=new Intl.DateTimeFormat('sv-SE',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'});
const clock=new Intl.DateTimeFormat('pt-BR',{timeZone:tz,dateStyle:'short',timeStyle:'short'});
const date=v=>v?clock.format(new Date(typeof v==='number'?v*1000:v)):'—';
const calendar=v=>v?.split('-').reverse().join('/')||'—';
const locationTitle=i=>i.location?(i.locationConfirmed?i.location:'Local sugerido: '+i.location):'Local a confirmar';
const caseDate=i=>i.serviceDay?'Atendimento: '+calendar(i.serviceDay):i.referenceAt?'Registro: '+date(i.referenceAt)+' · data do atendimento a confirmar':'Data a confirmar';
const orderDate=i=>i.serviceDay?Date.parse(i.serviceDay+'T00:00:00-03:00'):Number(i.referenceAt||0)*1000;
const byName=(a,b)=>a.title.localeCompare(b.title,'pt-BR',{sensitivity:'base',numeric:true})||a.code.localeCompare(b.code);
const statusOrder={open:0,pending:1,rescheduled:2,unconfirmed:3,completed:4,cancelled:5};
const counts={open:'Em andamento',pending:'Aguardando',rescheduled:'Remarcados',unconfirmed:'Sem etapa definida',completed:'Concluídos',cancelled:'Cancelados'};
const stageOrigin={source:'Do histórico do WhatsApp',note:'De atualização no painel',context:'Das respostas no painel',manual:'Definida manualmente',task:'De pendência cadastrada'};
function caseHeading(tag,i){const h=node(tag);h.append(node('span',locationTitle(i),'case-location'),node('span',i.title,'case-subject'));return h;}
const normal=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const codeFromHash=()=>/^#R-[A-F0-9]{8}$/.test(location.hash)?location.hash.slice(1):null;
let model={items:[],statuses:{}},area='ALL',selected=codeFromHash(),detail=null,tab='overview',listRequest=0,detailRequest=0,editing=null;
let contextDirty=false;
const node=(tag,value,cls)=>{const e=document.createElement(tag);if(value!==undefined)e.textContent=value;if(cls)e.className=cls;return e;};
const button=(value,fn,cls='button outline')=>{const e=node('button',value,cls);e.type='button';e.onclick=fn;return e;};
const badge=(value,tone='')=>node('span',value,'badge '+tone);
const context=i=>i.contextState==='complete'?'Contexto extraído completo':i.contextState==='analysis-pending'?'Resposta aguardando análise':'Falta informação nas fontes';
const stageBadge=i=>badge(model.statuses[i.status]||i.status,'stage-badge stage-'+i.status);
function stageReason(i){return i.stage?.scheduledFor?'Nova data: '+calendar(i.stage.scheduledFor)+(i.stage.reason?' · '+i.stage.reason:''):i.stage?.reason||'';}
function notify(value){$('notice').textContent=value;$('notice').hidden=!value;}
async function api(path,options){
  const r=await fetch('/api/cases'+path,{signal:AbortSignal.timeout(12000),...options});
  const data=await r.json();if(!r.ok)throw Error(data.error||'Consulta indisponível.');return data;
}
function block(parent,title){const b=node('section',undefined,'block');b.append(node('h3',title));parent.append(b);return b;}
function showCaseTab(id){
  if(id===tab)return;
  if(contextDirty&&!confirm('Descartar respostas não salvas?'))return;
  contextDirty=false;tab=id;renderDetail();$('detail').querySelector('.tab[aria-pressed=true]')?.focus();
}
function caseActions(item){
  const actions=node('div',undefined,'detail-actions');
  if(!item.profile.archived)actions.append(button('Registrar atualização',()=>edit('note'),'button primary'));
  const more=node('details',undefined,'action-disclosure');
  const toggle=node('summary','Mais ações','button outline');
  const list=node('div',undefined,'action-options');
  const add=(label,kind,cls='')=>list.append(button(label,()=>{toggle.focus();more.open=false;edit(kind);},'action-option '+cls));
  add('Editar chamado','profile');
  if(item.profile.archived)add('Restaurar chamado','restore');
  else{
    if(!['completed','cancelled'].includes(item.status))add('Marcar como concluído','complete');
    add('Reunir duplicado','merge');
    add('Arquivar chamado','archive','action-danger');
  }
  more.append(toggle,list);actions.append(more);
  more.addEventListener('focusout',e=>{if(!more.contains(e.relatedTarget))more.open=false;});
  more.addEventListener('keydown',e=>{if(e.key==='Escape'&&more.open){e.preventDefault();more.open=false;toggle.focus();}});
  return actions;
}
function renderList(){
  const items=model.items,query=normal($('search').value.trim());
  const stageFilter=$('filter'),previous=stageFilter.value;
  if(stageFilter.options.length===1){
    stageFilter.append(...Object.entries(model.statuses).map(([id,label])=>new Option(label,id)));
    stageFilter.value=previous||'all';
  }
  const filter=stageFilter.value;
  $('areas').replaceChildren(...Object.entries(labels).map(([id,name])=>{
    const b=button(name,()=>{area=id;const filtered=renderList();if(!filtered.some(i=>i.code===selected)){if(filtered.length)void openCase(filtered[0].code);else{detailRequest++;selected=null;detail=null;window.history.replaceState(null,'',location.pathname);$('detail').replaceChildren(node('p','Nenhum chamado nesta frente para o recorte atual.','empty'));}}},'area');b.setAttribute('aria-pressed',String(area===id));
    b.append(node('span',id==='ALL'?items.length:items.filter(x=>x.area===id).length,'nav-count'));return b;
  }));
  const totals=Object.fromEntries(Object.keys(counts).map(id=>[id,0]));
  for(const i of items)totals[Object.hasOwn(totals,i.status)?i.status:'unconfirmed']++;
  $('stats').replaceChildren(...[['all',items.length,'Total de chamados'],...Object.entries(counts).filter(([id])=>totals[id]||filter===id).map(([id,label])=>[id,totals[id],label])].map(([id,n,label])=>{
    const s=button('',()=>{stageFilter.value=id;renderList();$('stats').querySelector('[data-stage="'+id+'"]')?.focus();},'stat stage-'+id);
    s.dataset.stage=id;s.setAttribute('aria-pressed',String(filter===id));s.append(node('strong',n),node('span',label));return s;
  }));
  const visible=items.filter(i=>(area==='ALL'||i.area===area)&&(filter==='all'||i.status===filter)&&normal([i.code,i.title,i.summary,i.location,stageReason(i),labels[i.area]].join(' ')).includes(query));
  const sort=$('sort').value;
  const active=Number(filter!=='all')+Number(sort!=='recent')+Number($('carry').checked)+Number($('archived').checked);
  $('active-filters').textContent=active;$('active-filters').hidden=!active;
  visible.sort(sort==='name'?byName:sort==='status'?(a,b)=>(statusOrder[a.status]??9)-(statusOrder[b.status]??9)||byName(a,b):(a,b)=>(sort==='old'?1:-1)*(orderDate(a)-orderDate(b))||byName(a,b));
  $('queue-title').textContent=labels[area];$('queue-count').textContent=visible.length;
  $('case-list').replaceChildren(...visible.map(i=>{
    const b=button('',()=>{void openCase(i.code,true);},'case-card');b.setAttribute('aria-current',String(i.code===selected));
    const head=node('div',undefined,'card-head');head.append(node('span',i.code,'case-code'),badge(labels[i.area]));
    b.append(head,caseHeading('h3',i),node('p',caseDate(i)));
    if(i.summary)b.append(node('p',i.summary));
    const flags=node('div',undefined,'badges');
    flags.append(stageBadge(i));if(i.archived)flags.append(badge('Arquivado'));if(i.historical)flags.append(badge('Histórico · revisar'));if(i.carryover)flags.append(badge('Mês anterior'));if(i.missing.length||!i.serviceDay)flags.append(badge('⚠ Contexto a completar','amber'));b.append(flags);
    if(['pending','rescheduled','cancelled'].includes(i.status)&&stageReason(i))b.append(node('p',stageReason(i),'stage-card-reason'));
    return b;
  }));
  if(!visible.length)$('case-list').append(node('p','Nenhum chamado neste recorte. Ajuste o mês ou os filtros.','empty'));
  $('export').disabled=!items.some(i=>!i.archived);
  return visible;
}
function timeline(i){
  const records=[...i.sources,...i.notices].map(s=>({kind:s.kind,text:s.text,stamp:new Date(s.timestamp*1000).toISOString(),label:date(s.timestamp),sort:day.format(new Date(s.timestamp*1000))}));
  for(const e of i.profile.events){
    const changes=e.kind==='profile'?[e.before.area!==e.after.area?'Frente: '+(labels[e.after.area]||'automática'):'',e.before.title!==e.after.title?'Título: '+(e.after.title||'da fonte'):'',e.before.status!==e.after.status?'Etapa: '+(e.after.status==='unconfirmed'?'Pelas fontes':model.statuses[e.after.status]):'',e.before.location!==e.after.location?'Local: '+(e.after.location||'a confirmar'):'',e.before.serviceDay!==e.after.serviceDay?'Data do atendimento: '+(e.after.serviceDay?calendar(e.after.serviceDay):'a confirmar'):''].filter(Boolean).join(' · '):e.kind==='resolve'?e.taskText:'';
    records.push({kind:e.kind,text:[changes,e.text].filter(Boolean).join('\n'),label:e.occurredOn?calendar(e.occurredOn)+' · registrado em '+date(e.registeredAt):date(e.registeredAt),sort:e.occurredOn||day.format(new Date(e.registeredAt)),stamp:e.registeredAt});
  }
  return records.sort((a,b)=>b.sort.localeCompare(a.sort)||b.stamp.localeCompare(a.stamp));
}
function renderDetail(){
  if(!detail)return;
  const i=detail,head=node('header',undefined,'detail-head'),flags=node('div',undefined,'badges');
  flags.append(stageBadge(i),badge(labels[i.area]+(i.areaSuggested&&i.area!=='UNCLASSIFIED'?' · sugerida':'')));
  const top=node('div',undefined,'detail-top');
  top.append(node('p',i.code,'case-code'),caseActions(i));
  head.append(top,caseHeading('h2',i),flags,node('p',caseDate(i),'hint'));
  if(i.profile.archived)head.append(node('p','Arquivado: '+i.profile.archived.reason,'hint'));
  const tabs=node('nav',undefined,'tabs');tabs.setAttribute('aria-label','Detalhes do chamado');
  for(const [id,label] of [['overview','Resumo'],['history','Histórico'],['sources','Evidências'],['context','Contexto']]){
    const b=button(label,()=>showCaseTab(id),'tab');b.setAttribute('aria-pressed',String(tab===id));
    if(id==='sources')b.append(node('span',i.sourceCount,'tab-count'));
    if(id==='context'&&(i.missing.length||!i.serviceDay||i.status==='unconfirmed'||i.reportUpdates?.length))b.append(node('span','•','tab-alert'));
    tabs.append(b);
  }
  const body=node('div',undefined,'tab-body');
  if(tab==='overview'){
    const pending=block(body,i.status==='pending'?'O que falta para avançar':'Etapa atual');
    const row=node('div',undefined,'section-toolbar');
    row.append(pending.firstChild);
    pending.append(row);
    if(i.stageQuestion)pending.append(node('p',i.stageQuestion,'hint'),button('Informar etapa',()=>showCaseTab('context'),'button outline compact'));
    else if(i.stage?.origin!=='task'&&stageReason(i))pending.append(node('p',stageReason(i),'stage-evidence'));
    if(stageOrigin[i.stage?.origin])pending.append(node('p',stageOrigin[i.stage.origin],'hint'));
    for(const t of [...i.profile.tasks].sort((a,b)=>Number(!!a.resolvedAt)-Number(!!b.resolvedAt))){
      const card=node('div',undefined,'task'+(t.resolvedAt?' done':''));
      card.append(badge(t.resolvedAt?'Concluída':'Em aberto',t.resolvedAt?'green':'amber'),node('p',t.text),node('p',calendar(t.occurredOn),'hint'));
      if(t.resolvedAt)card.append(node('p',calendar(t.resolvedOn)+' — '+t.resolution));else card.append(button('Concluir pendência',()=>edit('resolve',t)));
      pending.append(card);
    }
    const tasks=node('details',undefined,'optional-task');
    tasks.append(node('summary','Adicionar pendência separada'),node('p','Use apenas se precisar acompanhar outra ação além do que já está no histórico.','hint'),button('Nova pendência',()=>edit('task'),'button outline compact'));pending.append(tasks);
    const gaps=block(body,'Informações para o relatório');
    if(i.reportUpdates?.length){
      const updates=node('section',undefined,'report-updates');
      updates.append(node('h4','Atualizações mais recentes'));
      for(const update of i.reportUpdates)updates.append(node('p',update.text,'evidence'),node('p',(stageOrigin[update.origin]||'Registro do chamado')+' · '+date(new Date(update.at).toISOString()),'hint'));
      updates.append(node('p','O contexto anterior foi preservado. Revise os campos de procedimento e resultado se necessário.','hint'),button('Revisar contexto',()=>showCaseTab('context'),'button outline compact'));
      gaps.append(updates);
    }
    if(i.missing.length||!i.reportUpdates?.length)gaps.append(node('p',i.missing.length?'A confirmar nas fontes: '+i.missing.map(k=>fields[k]||k).join(', ')+'.':context(i)+'.','hint'));
    const facts=node('dl',undefined,'facts');
    const earlier=node('dl',undefined,'facts');
    for(const f of i.facts){const row=node('div');row.append(node('dt',(fields[f.field]||f.field)+(f.prior?' · contexto anterior':f.confirmed?' · confirmado':' · extraído')),node('dd',f.quote));(f.prior?earlier:facts).append(row);}
    gaps.append(facts);
    if(earlier.children.length){const previous=node('details',undefined,'previous-context');previous.append(node('summary','Ver contexto anterior'),earlier);gaps.append(previous);}
  }
  if(tab==='history'){
    const h=block(body,'Linha do tempo'),list=node('ol',undefined,'timeline');
    for(const e of timeline(i)){const li=node('li');li.append(node('strong',kinds[e.kind]||e.kind),node('p',e.label,'hint'),node('p',e.text||'Sem texto.'));list.append(li);}h.append(list);
    if(!i.notices.some(n=>n.kind==='question')&&i.questionState==='sent')h.append(node('p','Pergunta enviada; texto não disponível no arquivo.','hint'));
  }
  if(tab==='sources'){
    renderEvidenceTools(body,i);
    const s=block(body,'Evidências arquivadas');
    i.sources.forEach((v,n)=>{
      const card=node('div',undefined,'record');card.append(node('h4',kinds[v.kind]),node('p',date(v.timestamp),'hint'),node('p',v.text||'Mensagem sem legenda.'));
      if(v.mediaState==='saved'&&/^image\/(jpeg|png|webp)(;|$)/.test(v.mime||''))card.append(button('Ver imagem',function(){
        this.disabled=true;const img=node('img');img.alt='Imagem da fonte arquivada';img.onerror=()=>{img.replaceWith(node('p','Imagem não disponível para visualização.','hint'));};img.src='/api/cases/'+i.code+'/media/'+n;card.append(img);
      }));else if(v.hasMedia)card.append(node('p',v.mediaState==='saved'?'Anexo arquivado; tipo sem visualização neste painel.':'Anexo não disponível no arquivo.','hint'));
      s.append(card);
    });
  }
  if(tab==='context')renderContext(body,i);
  $('detail').replaceChildren(head,tabs,body);
}
function offerTabSuggestion(control,suggestion,id){
  if(!suggestion||suggestion.length>control.maxLength)return;
  control.placeholder=suggestion;
  control.setAttribute('aria-describedby',id);
  const canAccept=()=>control.value!==suggestion&&suggestion.startsWith(control.value);
  control.addEventListener('keydown',event=>{
    if(event.key!=='Tab'||event.defaultPrevented||event.shiftKey||event.ctrlKey||event.altKey||event.metaKey||event.isComposing||!canAccept())return;
    control.value=suggestion;
    control.dispatchEvent(new Event('input',{bubbles:true}));
    // Let the browser move focus normally after accepting the suggestion.
  });
}
function renderContext(parent,item){
  const section=block(parent,'Contexto do atendimento'),form=node('form',undefined,'context-form'),meta=node('div',undefined,'form-columns');
  const questions={equipamento:'Equipamento atendido',ocorrencia:'Ocorrência',procedimento:'Serviço executado',resultado:'Resultado ou pendência'};
  const label=(name,control,target=form)=>{const l=node('label',name,'control');l.append(control);target.append(l);return control;};
  const hint=node('p',undefined,'context-tip');hint.id='context-suggestion-tip';
  hint.append(node('kbd','Tab'),document.createTextNode(' usa a sugestão em cinza. Confirme apenas o que você verificou.'));
  section.append(hint);
  const stageFields=node('div',undefined,'stage-fields'),stageTitle=node('p',item.stageQuestion||('Etapa atual: '+(model.statuses[item.status]||item.status)),'hint');
  stageFields.append(stageTitle);form.append(stageFields,meta);
  const stage=label('Etapa do chamado',node('select'),stageFields);
  stage.append(new Option('Usar o andamento dos registros','unconfirmed'),...Object.entries(model.statuses).filter(([k])=>k!=='unconfirmed').map(([k,v])=>new Option(v,k)));
  stage.value=item.profile.status||'unconfirmed';
  const reason=label('Motivo ou próxima ação',node('textarea'),stageFields);
  reason.rows=2;reason.maxLength=500;reason.value=(item.profile.stageReason||'').slice(0,500);
  const scheduled=label('Nova data (se confirmada)',node('input'),stageFields);
  scheduled.type='date';scheduled.value=item.profile.scheduledFor||'';
  const initialStage=[stage.value,reason.value,scheduled.value];
  const stageChanged=()=>stage.value!==initialStage[0]||stage.value!=='unconfirmed'&&(reason.value!==initialStage[1]||(stage.value==='rescheduled'?scheduled.value:'')!==initialStage[2]);
  function stageFieldsState(){
    const automatic=stage.value==='unconfirmed';
    reason.parentElement.hidden=automatic;scheduled.parentElement.hidden=stage.value!=='rescheduled';
    reason.required=stageChanged()&&['pending','cancelled','rescheduled','completed'].includes(stage.value);
    reason.parentElement.firstChild.textContent=({pending:'Aguardando o quê ou quem?',cancelled:'Por que foi cancelado?',rescheduled:'Motivo da remarcação',completed:'O que confirma a conclusão?'})[stage.value]||'Motivo ou próxima ação (opcional)';
    if(automatic){stageTitle.textContent=item.stageQuestion||('Etapa dos registros: '+(model.statuses[item.status]||item.status));}
    else stageTitle.textContent='Uma etapa manual fica fixa até você mudar ou voltar a usar os registros.';
  }
  stage.onchange=stageFieldsState;reason.oninput=stageFieldsState;scheduled.oninput=stageFieldsState;stageFieldsState();
  const place=label('Local do atendimento',node('input'),meta);place.maxLength=150;place.value=item.profile.location||'';place.placeholder=item.location||'Torre, setor, pavimento ou unidade';
  if(!item.locationConfirmed)offerTabSuggestion(place,item.location,hint.id);
  const when=label('Data do atendimento',node('input'),meta);when.type='date';when.max=day.format(new Date());when.value=item.serviceDay||'';
  const controls={};
  for(const [k,q] of Object.entries(questions)){
    const t=label(q,node('textarea'));t.rows=2;t.maxLength=1000;t.value=item.profile.answers?.[k]||'';
    if(item.facts.some(f=>f.field===k&&f.prior))t.parentElement.append(node('small','Contexto anterior: confira as atualizações do histórico antes de usar este texto.','hint'));
    const evidence=item.facts.filter(f=>f.field===k&&!f.confirmed).map(f=>f.quote).join(' · ');
    offerTabSuggestion(t,evidence,hint.id);
    controls[k]=t;
  }
  const save=node('button','Salvar respostas','button primary');form.append(save);section.append(form);
  form.oninput=()=>{contextDirty=true;};
  form.onsubmit=async e=>{
    e.preventDefault();save.disabled=true;
    const stageUpdate=stageChanged()?{stage:{status:stage.value,reason:stage.value==='unconfirmed'?'':reason.value,scheduledFor:stage.value==='rescheduled'?scheduled.value:''}}:{};
    try{const saved=await api('/'+item.code,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'context',version:item.version,location:place.value,serviceDay:when.value,answers:Object.fromEntries(Object.entries(controls).map(([k,v])=>[k,v.value])),...stageUpdate})});contextDirty=false;if(selected===item.code){detail=saved;renderDetail();}await refresh();notify('Contexto salvo, sem mensagem no WhatsApp.');}
    catch(err){notify(err.message);}
    finally{save.disabled=false;}
  };
  const sources=node('details');sources.append(node('summary','Ler as fontes e atualizações do chamado'));
  for(const s of timeline(item))if(s.text)sources.append(node('p',s.label+' — '+s.text,'record'));
  section.append(sources);
}
function renderEvidenceTools(parent,item){
  const actions=node('div',undefined,'evidence-actions'),photos=node('details',undefined,'evidence-upload');
  const summary=node('summary','Adicionar foto','button outline'),fields=node('div',undefined,'evidence-upload-fields');
  const picker=node('input');picker.type='file';picker.accept='image/jpeg,image/png,image/webp';picker.setAttribute('aria-label','Selecionar foto do chamado');
  const upload=button('Anexar foto',async()=>{
    const file=picker.files[0];if(!file){notify('Selecione uma foto.');return;}if(contextDirty){notify('Salve as respostas antes de anexar a foto.');return;}if(file.size>5*1024*1024){notify('A foto deve ter até 5 MB.');return;}
    upload.disabled=true;
    try{const updated=await api('/'+item.code+'/photo',{method:'POST',headers:{'Content-Type':file.type},body:file});if(selected===item.code){detail=updated;renderDetail();}await refresh();notify('Foto anexada localmente.');}
    catch(err){notify(err.message);}
    finally{upload.disabled=false;}
  });
  const link=node('a','Vincular uma fonte do histórico');link.href='/historico?month='+encodeURIComponent($('month').value)+'&code='+item.code;
  link.className='button outline';
  fields.append(node('p','JPEG, PNG ou WebP de até 5 MB.','hint'),picker,upload);
  photos.append(summary,fields);actions.append(photos,link);parent.append(actions);
}
async function openCase(code,scroll=false){
  if(contextDirty&&code!==selected&&!confirm('Descartar respostas não salvas?'))return;
  if(code!==selected)contextDirty=false;
  const request=++detailRequest;
  try{const next=await api('/'+code);if(request!==detailRequest)return;const changed=selected!==code;selected=code;detail=next;if(changed)tab='overview';historyReplace(code);renderList();renderDetail();if(scroll&&matchMedia('(max-width:640px)').matches)$('detail').scrollIntoView({block:'start'});}
  catch(e){if(request===detailRequest)notify(e.message);}
}
function historyReplace(code){window.history.replaceState(null,'','#'+code);}
async function refresh(manual=false){
  const request=++listRequest;
  try{
    const next=await api('?month='+encodeURIComponent($('month').value)+'&carry='+Number($('carry').checked)+'&archived='+Number($('archived').checked));
    if(request!==listRequest)return;
    model=next;renderHistoryDot(next.unlinkedCount||0);const visible=renderList();
    const chosen=selected||visible[0]?.code;
    const row=next.items.find(i=>i.code===chosen);
    if(chosen&&!editing&&!contextDirty&&(!detail||manual||(row&&(row.updatedAt!==detail.updatedAt||row.version!==detail.version||row.contextState!==detail.contextState||row.sourceCount!==detail.sourceCount))))await openCase(chosen);
    if(manual)notify('Lista atualizada.');
  }catch(e){if(request===listRequest)notify(e.message);}
}
async function pulse(){
  try{
    const s=await api('/runtime');
    const label=s.requiresLink?'Novo vínculo necessário':s.paused?'Coleta pausada':s.connected?'WhatsApp conectado':s.selected?'Aguardando conexão com o WhatsApp':'Grupo ainda não autorizado';
    $('runtime-label').textContent=label;
    $('runtime').parentElement.dataset.online=String(s.connected&&!s.paused&&!s.error);
    $('runtime').textContent=[s.supervised?'Supervisão ativa':'Sem supervisão confirmada','Última checagem: '+date(s.lastTransportCheck),'Última sincronização: '+date(s.lastSyncAt),s.recovering?'Recuperando histórico':null,s.analysisPending?s.analysisPending+' aguardando análise':null,s.error].filter(Boolean).join(' · ');
  }catch{$('runtime-label').textContent='Coletor indisponível';$('runtime').parentElement.dataset.online='false';$('runtime').textContent='Sem resposta do coletor local. A conexão do WhatsApp não está confirmada.';}
}
function updateMergeDirection(reset=false){
  if(editing?.kind!=='merge')return;
  const target=editing.targets?.find(t=>t.code===$('merge-target').value);
  if(reset||!target)$('merge-keep-open').checked=true;
  $('merge-other').textContent=target?target.title+' · '+target.code:'';
  $('merge-direction').hidden=!target;
  $('save').disabled=!target||!!editing.saving;
}
function renderMergeTargets(){
  if(editing?.kind!=='merge')return;
  const select=$('merge-target'),previous=select.value;
  const words=normal($('merge-search').value.trim()).split(/\s+/).filter(Boolean);
  const rows=editing.targets.filter(t=>{
    const text=normal([t.title,t.location,labels[t.area],t.area,t.code,t.month].join(' '));
    return words.every(word=>text.includes(word));
  });
  select.replaceChildren(new Option(rows.length?'Selecione o outro chamado':editing.targets.length?'Nenhum chamado encontrado':'Nenhum outro chamado disponível',''));
  for(const [current,label] of [[true,'Nesta competência'],[false,'Outras competências']]){
    const group=node('optgroup');group.label=label;
    for(const t of rows.filter(t=>t.current===current)){
      const when=t.day?calendar(t.day):t.referenceAt?date(t.referenceAt):t.month;
      group.append(new Option([t.title,t.location,labels[t.area],when,t.code].filter(Boolean).join(' · '),t.code));
    }
    if(group.children.length)select.append(group);
  }
  select.disabled=!rows.length;
  select.value=rows.some(t=>t.code===previous)?previous:'';
  updateMergeDirection();
}
async function loadMergeTargets(dialog){
  try{
    const data=await api('/history?'+new URLSearchParams({month:$('month').value,targets:'1'}));
    if(editing!==dialog||!$('edit-dialog').open)return;
    dialog.targets=data.targets.filter(t=>/^R-[A-F0-9]{8}$/.test(t.code)&&t.code!==dialog.code);
    renderMergeTargets();
  }catch{
    if(editing!==dialog||!$('edit-dialog').open)return;
    $('merge-target').replaceChildren(new Option('Lista indisponível',''));
    $('form-error').textContent='Não foi possível carregar os chamados. Feche e abra a janela para tentar de novo.';
    $('form-error').hidden=false;
  }
}
function edit(kind,task){
  editing={kind,task,code:detail.code,version:detail.version};
  $('dialog-title').textContent={profile:'Editar chamado',complete:'Marcar como concluído',note:'Registrar atualização',task:'Nova pendência',resolve:'Concluir pendência',archive:'Arquivar chamado',restore:'Restaurar chamado',merge:'Reunir chamados'}[kind];
  $('dialog-code').textContent=detail.code;$('profile-fields').hidden=kind!=='profile';
  $('edit-title').value=detail.profile.title;
  $('edit-location').value=detail.profile.location||'';
  $('edit-location').placeholder=detail.location?'Confirme: '+detail.location:'Qual torre, setor, pavimento ou unidade?';
  $('edit-service-day').value=detail.serviceDay||'';
  $('edit-service-day').max=day.format(new Date());
  $('edit-area').replaceChildren(new Option('Usar sugestão automática',''),...Object.entries(labels).filter(([k])=>k!=='ALL').map(([k,v])=>new Option(v,k)));
  $('edit-area').value=detail.profile.area||'';
  $('edit-note').maxLength=kind==='task'?500:2000;$('edit-note').value='';$('edit-day').value='';$('edit-day').max=day.format(new Date());
  $('note-label').textContent=kind==='complete'?'O que confirma a conclusão?':kind==='archive'?'Motivo (ex.: duplicado do chamado R-…)':kind==='resolve'?'Como a pendência foi resolvida?':kind==='profile'?'Observação ou correção técnica':'Descrição';
  $('date-label').textContent=kind==='complete'?'Data real da conclusão':'Data real da atualização';
  $('edit-note').parentElement.hidden=['restore','merge'].includes(kind);
  $('duplicate-field').hidden=kind!=='merge';
  $('save').textContent=kind==='merge'?'Reunir chamados':'Salvar';
  $('save').disabled=kind==='merge';
  if(kind==='archive')$('edit-note').maxLength=1000;
  $('form-error').hidden=true;configureForm();$('edit-dialog').showModal();
  if(kind==='merge'){
    $('merge-main').textContent=detail.title+' · '+detail.code;
    $('merge-direction').hidden=true;
    $('merge-keep-open').checked=true;
    $('merge-search').value='';
    $('merge-target').disabled=true;
    $('merge-target').replaceChildren(new Option('Carregando chamados…',''));
    $('merge-search').focus();
    void loadMergeTargets(editing);
  }
}
function configureForm(){if(!editing)return;const required=!['archive','restore','merge','profile'].includes(editing.kind);$('date-field').hidden=!required;$('edit-day').required=required;$('edit-note').required=required||editing.kind==='archive';}
for(const id of ['cancel','cancel-top'])$(id).onclick=()=>{if(!editing?.saving)$('edit-dialog').close();};
$('edit-dialog').oncancel=e=>{if(editing?.saving)e.preventDefault();};
$('merge-search').oninput=()=>{if(editing?.targets)renderMergeTargets();};
$('merge-target').onchange=()=>updateMergeDirection(true);
$('edit-dialog').onclose=()=>{editing=null;};
$('edit-form').onsubmit=async e=>{
  e.preventDefault();if(!editing||editing.saving)return;
  const {kind,version,code,task}=editing,occurredOn=$('edit-day').value,note=$('edit-note').value;
  const target=kind==='merge'?editing.targets?.find(t=>t.code===$('merge-target').value):null;
  if(kind==='merge'&&!target)return;
  const keepTarget=kind==='merge'&&$('merge-keep-target').checked;
  const main=keepTarget?target:{code,title:detail.title};
  const duplicate=keepTarget?{code,title:detail.title}:target;
  if(kind==='merge'&&!confirm('Reunir “'+duplicate.title+'” ('+duplicate.code+') em “'+main.title+'” ('+main.code+')? O segundo chamado permanece e o primeiro é arquivado.'))return;
  const submission=editing;submission.saving=true;
  $('save').disabled=true;
  $('form-error').hidden=true;
  try{
    let mainVersion=version;
    if(keepTarget){
      const latest=await api('/'+main.code);
      if(latest.code!==main.code||latest.profile.archived||!Number.isInteger(latest.version))throw Error('O chamado escolhido como principal não está mais disponível. Reabra a janela para atualizar a lista.');
      mainVersion=latest.version;
    }
    const payload=kind==='archive'?{kind,version,text:note}:kind==='restore'?{kind,version}:kind==='merge'?{kind,version:mainVersion,duplicate:duplicate.code}:kind==='complete'?{kind:'profile',version,area:detail.profile.area,title:detail.profile.title,status:'completed',note,occurredOn}:kind==='profile'?{kind,version,area:$('edit-area').value||null,title:$('edit-title').value,status:detail.profile.status||'unconfirmed',location:$('edit-location').value,serviceDay:$('edit-service-day').value,note}:{kind,version,text:note,occurredOn,...(task?{taskId:task.id}:{})};
    detail=await api('/'+main.code,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    if(kind==='merge'){
      detailRequest++;selected=main.code;tab='history';historyReplace(main.code);
    }
    $('edit-dialog').close();renderDetail();await refresh();
    notify(kind==='merge'?'Chamados reunidos. Nenhuma mensagem enviada.':'Alteração salva no painel. Nenhuma mensagem enviada.');
  }
  catch(e){$('form-error').textContent=e.message;$('form-error').hidden=false;}
  finally{submission.saving=false;if(editing===submission)$('save').disabled=kind==='merge'&&!$('merge-target').value;}
};
$('export').onclick=async()=>{
  const month=model.month,items=model.items.filter(i=>!i.archived);$('export').disabled=true;
  try{
    const lines=['BASE DE CONFERÊNCIA · '+month,'Não é o relatório final. Andamentos atuais; confira as datas de cada fonte e atualização.'];
    for(const row of items){
      const i=await api('/'+row.code);
      lines.push('',i.code+' · '+labels[i.area]+' · '+i.title+(row.carryover?' [mês anterior]':''),model.statuses[i.status]+' | '+context(i));
      if(i.missing.length)lines.push('A confirmar: '+i.missing.map(k=>fields[k]||k).join(', '));
      for(const e of timeline(i).reverse())lines.push(e.label+' · '+(kinds[e.kind]||e.kind)+': '+e.text);
      for(const t of i.profile.tasks.filter(t=>!t.resolvedAt))lines.push('Em aberto: '+t.text);
    }
    const url=URL.createObjectURL(new Blob([lines.join('\r\n')],{type:'text/plain;charset=utf-8'}));
    const a=node('a');a.href=url;a.download='base-chamados-'+month+'.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(e){notify(e.message);}finally{$('export').disabled=!model.items.length;}
};
const requestedMonth=new URLSearchParams(location.search).get('month');
$('month').value=/^20\d\d-(0[1-9]|1[0-2])$/.test(requestedMonth||'')?requestedMonth:day.format(new Date()).slice(0,7);
$('month').onchange=()=>{const url=new URL(location.href);url.searchParams.set('month',$('month').value);window.history.replaceState(null,'',url);renderHistoryDot(0);void refresh();};
$('carry').onchange=()=>void refresh();
$('archived').onchange=()=>void refresh();
$('sort').onchange=()=>renderList();
function monthLinks(){for(const [id,route] of [['closing-link','/fechamento'],['history-link','/historico']])$(id).href=route+'?month='+encodeURIComponent($('month').value);}
function renderHistoryDot(count){
  const link=$('history-link');$('history-dot').hidden=!count;
  const label=count===1?'1 registro sem chamado neste mês':count+' registros sem chamado neste mês';
  if(count){link.title=label;link.setAttribute('aria-label','Histórico sem chamado: '+label);}
  else{link.removeAttribute('title');link.removeAttribute('aria-label');}
}
$('month').addEventListener('change',monthLinks);monthLinks();
$('search').oninput=$('filter').onchange=renderList;
$('refresh').onclick=()=>{void refresh(true);void pulse();};
window.addEventListener('hashchange',()=>{const code=codeFromHash();if(code&&!editing)void openCase(code);});
window.addEventListener('pageshow',e=>{if(e.persisted)void refresh();});
void refresh();void pulse();setInterval(()=>{if(!document.hidden){void refresh();void pulse();}},15000);
