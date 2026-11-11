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
const statusOrder={unconfirmed:0,open:1,pending:2,completed:3};
function caseHeading(tag,i){const h=node(tag);h.append(node('span',locationTitle(i),'case-location'),node('span',i.title,'case-subject'));return h;}
const normal=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const codeFromHash=()=>/^#R-[A-F0-9]{8}$/.test(location.hash)?location.hash.slice(1):null;
let model={items:[],statuses:{}},area='ALL',selected=codeFromHash(),detail=null,tab='overview',listRequest=0,detailRequest=0,editing=null;
let contextDirty=false;
const node=(tag,value,cls)=>{const e=document.createElement(tag);if(value!==undefined)e.textContent=value;if(cls)e.className=cls;return e;};
const button=(value,fn,cls='button outline')=>{const e=node('button',value,cls);e.type='button';e.onclick=fn;return e;};
const badge=(value,tone='')=>node('span',value,'badge '+tone);
const context=i=>i.contextState==='complete'?'Contexto extraído completo':i.contextState==='analysis-pending'?'Resposta aguardando análise':'Falta informação nas fontes';
const attention=i=>i.contextState!=='complete'||!i.serviceDay||i.openTasks>0||i.status==='pending'||i.status==='unconfirmed';
function notify(value){$('notice').textContent=value;$('notice').hidden=!value;}
async function api(path,options){
  const r=await fetch('/api/cases'+path,{signal:AbortSignal.timeout(12000),...options});
  const data=await r.json();if(!r.ok)throw Error(data.error||'Consulta indisponível.');return data;
}
function block(parent,title){const b=node('section',undefined,'block');b.append(node('h3',title));parent.append(b);return b;}
function renderList(){
  const items=model.items,query=normal($('search').value.trim()),filter=$('filter').value;
  $('areas').replaceChildren(...Object.entries(labels).map(([id,name])=>{
    const b=button(name,()=>{area=id;const filtered=renderList();if(!filtered.some(i=>i.code===selected)){if(filtered.length)void openCase(filtered[0].code);else{detailRequest++;selected=null;detail=null;window.history.replaceState(null,'',location.pathname);$('detail').replaceChildren(node('p','Nenhum chamado nesta frente para o recorte atual.','empty'));}}},'area');b.setAttribute('aria-pressed',String(area===id));
    b.append(node('span',id==='ALL'?items.length:items.filter(x=>x.area===id).length,'nav-count'));return b;
  }));
  $('stats').replaceChildren(...[[items.length,'Chamados no recorte'],[items.filter(i=>i.contextState!=='complete').length,'Com lacunas de informação','attention'],[items.reduce((n,i)=>n+i.openTasks,0),'Pendências abertas','attention'],[items.filter(i=>i.status==='completed').length,'Concluídos confirmados','complete']].map(([n,label,tone])=>{
    const s=node('div',undefined,'stat '+(tone||''));s.append(node('strong',n),node('span',label));return s;
  }));
  const visible=items.filter(i=>(area==='ALL'||i.area===area)&&(filter==='all'||(filter==='attention'?attention(i):i.status===filter))&&normal([i.code,i.title,i.summary,i.location,labels[i.area]].join(' ')).includes(query));
  const sort=$('sort').value;
  visible.sort(sort==='name'?byName:sort==='status'?(a,b)=>(statusOrder[a.status]??9)-(statusOrder[b.status]??9)||byName(a,b):(a,b)=>(sort==='old'?1:-1)*(orderDate(a)-orderDate(b))||byName(a,b));
  $('queue-title').textContent=labels[area];$('queue-count').textContent=visible.length;
  $('case-list').replaceChildren(...visible.map(i=>{
    const b=button('',()=>{void openCase(i.code,true);},'case-card');b.setAttribute('aria-current',String(i.code===selected));
    const head=node('div',undefined,'card-head');head.append(node('span',i.code,'case-code'),badge(labels[i.area]));
    b.append(head,caseHeading('h3',i),node('p',caseDate(i)));
    if(i.summary)b.append(node('p',i.summary));
    const flags=node('div',undefined,'badges');
    flags.append(badge(model.statuses[i.status]||i.status,i.status==='completed'?'green':''));if(i.archived)flags.append(badge('Arquivado'));if(i.historical)flags.append(badge('Histórico · revisar'));if(i.carryover)flags.append(badge('Mês anterior'));if(i.openTasks)flags.append(badge(i.openTasks+' pendência(s)','amber'));if(i.missing.length||!i.serviceDay)flags.append(badge('⚠ Contexto a completar','amber'));b.append(flags);return b;
  }));
  if(!visible.length)$('case-list').append(node('p','Nenhum chamado neste recorte. Ajuste o mês ou os filtros.','empty'));
  $('export').disabled=!items.some(i=>!i.archived);
  return visible;
}
function timeline(i){
  const records=[...i.sources,...i.notices].map(s=>({kind:s.kind,text:s.text,stamp:new Date(s.timestamp*1000).toISOString(),label:date(s.timestamp),sort:day.format(new Date(s.timestamp*1000))}));
  for(const e of i.profile.events){
    const changes=e.kind==='profile'?[e.before.area!==e.after.area?'Frente: '+(labels[e.after.area]||'automática'):'',e.before.title!==e.after.title?'Título: '+(e.after.title||'da fonte'):'',e.before.status!==e.after.status?'Andamento: '+model.statuses[e.after.status]:'',e.before.location!==e.after.location?'Local: '+(e.after.location||'a confirmar'):'',e.before.serviceDay!==e.after.serviceDay?'Data do atendimento: '+(e.after.serviceDay?calendar(e.after.serviceDay):'a confirmar'):''].filter(Boolean).join(' · '):e.kind==='resolve'?e.taskText:'';
    records.push({kind:e.kind,text:[changes,e.text].filter(Boolean).join('\n'),label:e.occurredOn?calendar(e.occurredOn)+' · registrado em '+date(e.registeredAt):date(e.registeredAt),sort:e.occurredOn||day.format(new Date(e.registeredAt)),stamp:e.registeredAt});
  }
  return records.sort((a,b)=>b.sort.localeCompare(a.sort)||b.stamp.localeCompare(a.stamp));
}
function renderDetail(){
  if(!detail)return;
  const i=detail,head=node('header',undefined,'detail-head'),flags=node('div',undefined,'badges');
  flags.append(badge(labels[i.area]+(i.areaSuggested&&i.area!=='UNCLASSIFIED'?' · sugerida':'')),badge(model.statuses[i.status]||i.status,i.status==='completed'?'green':''),badge(context(i),i.contextState==='complete'?'green':'amber'));
  head.append(node('p',i.code,'case-code'),caseHeading('h2',i),flags,node('p',caseDate(i)+' · '+i.sourceCount+' fonte(s) · '+i.answerCount+' resposta(s)','hint'));
  if(!i.locationConfirmed)head.append(node('p','Qual é o local exato? Confirme a torre, setor, pavimento ou unidade em Editar chamado.','notice'));
  if(i.completionSuggestion&&!i.profile.archived){
    const prompt=node('div',undefined,'notice');
    prompt.append(node('strong','O serviço foi concluído?'),node('p','O registro mais recente menciona retorno à operação. Confira antes de confirmar.'),node('p','“'+i.completionSuggestion.quote+'”'));
    head.append(prompt);
  }
  const actions=node('div',undefined,'detail-actions');
  if(i.profile.archived)head.append(node('p','Arquivado: '+i.profile.archived.reason,'notice'));
  actions.append(button('Editar chamado',()=>edit('profile')),button('Registrar atualização',()=>edit('note'),'button primary'),button('Nova pendência',()=>edit('task')),button('Completar contexto e fotos',()=>{if(tab!=='context'){tab='context';renderDetail();}}));
  if(i.status!=='completed'&&!i.profile.archived)actions.append(button('Marcar como concluído',()=>edit('complete')));
  if(!i.profile.archived)actions.append(button('Reunir duplicado',()=>edit('merge')));
  head.append(actions);
  actions.append(button(i.profile.archived?'Restaurar chamado':'Arquivar chamado',()=>edit(i.profile.archived?'restore':'archive')));
  const tabs=node('nav',undefined,'tabs');tabs.setAttribute('aria-label','Detalhes do chamado');
  for(const [id,label] of [['overview','Visão geral'],['history','Histórico'],['sources','Fontes e fotos'],['context','Completar contexto']]){const b=button(label,()=>{if(contextDirty&&id!==tab&&!confirm('Descartar respostas não salvas?'))return;if(id===tab)return;contextDirty=false;tab=id;renderDetail();$('detail').querySelector('.tab[aria-pressed=true]')?.focus();},'tab');b.setAttribute('aria-pressed',String(tab===id));tabs.append(b);}
  const body=node('div',undefined,'tab-body');
  if(tab==='overview'){
    const pending=block(body,'Pendências operacionais');
    if(!i.profile.tasks.length)pending.append(node('p','Nenhuma pendência operacional cadastrada.','hint'));
    for(const t of [...i.profile.tasks].sort((a,b)=>Number(!!a.resolvedAt)-Number(!!b.resolvedAt))){
      const card=node('div',undefined,'task'+(t.resolvedAt?' done':''));
      card.append(badge(t.resolvedAt?'Concluída':'Em aberto',t.resolvedAt?'green':'amber'),node('p',t.text),node('p',calendar(t.occurredOn),'hint'));
      if(t.resolvedAt)card.append(node('p',calendar(t.resolvedOn)+' — '+t.resolution));else card.append(button('Concluir pendência',()=>edit('resolve',t)));
      pending.append(card);
    }
    const gaps=block(body,'Informações para o relatório');
    gaps.append(node('p',i.missing.length?'A confirmar nas fontes: '+i.missing.map(k=>fields[k]||k).join(', ')+'.':context(i)+'.','hint'));
    const facts=node('dl',undefined,'facts');
    for(const f of i.facts){const row=node('div');row.append(node('dt',(fields[f.field]||f.field)+(f.confirmed?' · confirmado':' · extraído')),node('dd',f.quote));facts.append(row);}gaps.append(facts);
  }
  if(tab==='history'){
    const h=block(body,'Linha do tempo'),list=node('ol',undefined,'timeline');
    for(const e of timeline(i)){const li=node('li');li.append(node('strong',kinds[e.kind]||e.kind),node('p',e.label,'hint'),node('p',e.text||'Sem texto.'));list.append(li);}h.append(list);
    if(!i.notices.some(n=>n.kind==='question')&&i.questionState==='sent')h.append(node('p','Pergunta enviada; texto não disponível no arquivo.','hint'));
  }
  if(tab==='sources'){
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
function renderContext(parent,item){
  const section=block(parent,'Respostas confirmadas'),form=node('form');
  const questions={equipamento:'Qual equipamento foi atendido?',ocorrencia:'O que aconteceu?',procedimento:'O que foi executado?',resultado:'Qual foi o resultado observado ou a pendência?'};
  const label=(name,control)=>{const l=node('label',name,'control');l.append(control);form.append(l);return control;};
  section.append(node('p','Preencha só o que você puder confirmar. Os trechos extraídos aparecem como referência, não como respostas confirmadas.','hint'));
  const place=label('Onde? Torre, setor, pavimento ou unidade',node('input'));place.maxLength=150;place.value=item.profile.location||'';place.placeholder=item.location||'Informe o local exato';
  const when=label('Qual foi a data real do atendimento?',node('input'));when.type='date';when.max=day.format(new Date());when.value=item.serviceDay||'';
  const controls={};
  for(const [k,q] of Object.entries(questions)){
    const t=label(q,node('textarea'));t.rows=2;t.maxLength=1000;t.value=item.profile.answers?.[k]||'';
    const evidence=item.facts.filter(f=>f.field===k&&!f.confirmed).map(f=>f.quote).join(' · ');
    if(evidence)t.placeholder=evidence.slice(0,280);
    controls[k]=t;
  }
  const save=node('button','Salvar respostas','button primary');form.append(save);section.append(form);
  form.oninput=()=>{contextDirty=true;};
  form.onsubmit=async e=>{
    e.preventDefault();save.disabled=true;
    try{const saved=await api('/'+item.code,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'context',version:item.version,location:place.value,serviceDay:when.value,answers:Object.fromEntries(Object.entries(controls).map(([k,v])=>[k,v.value]))})});contextDirty=false;if(selected===item.code){detail=saved;renderDetail();}await refresh();notify('Respostas salvas, sem mensagem no WhatsApp.');}
    catch(err){notify(err.message);}
    finally{save.disabled=false;}
  };
  const sources=node('details');sources.append(node('summary','Ler as fontes e atualizações do chamado'));
  for(const s of timeline(item))if(s.text)sources.append(node('p',s.label+' — '+s.text,'record'));
  section.append(sources);
  const photos=block(parent,'Adicionar fotos'),picker=node('input');picker.type='file';picker.accept='image/jpeg,image/png,image/webp';picker.setAttribute('aria-label','Selecionar foto do chamado');
  const upload=button('Anexar foto',async()=>{
    const file=picker.files[0];if(!file){notify('Selecione uma foto.');return;}if(contextDirty){notify('Salve as respostas antes de anexar a foto.');return;}if(file.size>5*1024*1024){notify('A foto deve ter até 5 MB.');return;}
    upload.disabled=true;
    try{const updated=await api('/'+item.code+'/photo',{method:'POST',headers:{'Content-Type':file.type},body:file});if(selected===item.code){detail=updated;renderDetail();}await refresh();notify('Foto anexada localmente.');}
    catch(err){notify(err.message);}
    finally{upload.disabled=false;}
  });
  const link=node('a','Vincular uma fonte do histórico');link.href='/historico?month='+encodeURIComponent($('month').value)+'&code='+item.code;
  photos.append(node('p','JPEG, PNG ou WebP de até 5 MB. O anexo fica neste chamado e pode ser selecionado na minuta.','hint'),picker,upload,node('br'),link);
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
    model=next;const visible=renderList();
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
    $('runtime').textContent=[label,s.supervised?'Supervisão ativa':'Sem supervisão confirmada','Última checagem: '+date(s.lastTransportCheck),'Última sincronização: '+date(s.lastSyncAt),s.recovering?'Recuperando histórico':null,s.analysisPending?s.analysisPending+' aguardando análise':null,s.error].filter(Boolean).join(' · ');
  }catch{$('runtime').textContent='Sem resposta do coletor local. A conexão do WhatsApp não está confirmada.';}
}
function edit(kind,task){
  editing={kind,task,code:detail.code,version:detail.version,status:detail.status};
  $('dialog-title').textContent={profile:'Editar chamado',complete:'Marcar como concluído',note:'Registrar atualização',task:'Nova pendência',resolve:'Concluir pendência',archive:'Arquivar chamado',restore:'Restaurar chamado',merge:'Reunir ao chamado atual'}[kind];
  $('dialog-code').textContent=detail.code;$('profile-fields').hidden=kind!=='profile';
  $('edit-title').value=detail.profile.title;
  $('edit-location').value=detail.profile.location||'';
  $('edit-location').placeholder=detail.location?'Confirme: '+detail.location:'Qual torre, setor, pavimento ou unidade?';
  $('edit-service-day').value=detail.serviceDay||'';
  $('edit-service-day').max=day.format(new Date());
  $('edit-area').replaceChildren(new Option('Usar sugestão automática',''),...Object.entries(labels).filter(([k])=>k!=='ALL').map(([k,v])=>new Option(v,k)));
  $('edit-area').value=detail.profile.area||'';
  $('edit-status').replaceChildren(...Object.entries(model.statuses).map(([k,v])=>new Option(v,k)));$('edit-status').value=detail.status;
  $('edit-note').maxLength=kind==='task'?500:2000;$('edit-note').value='';$('edit-day').value='';$('edit-day').max=day.format(new Date());
  $('note-label').textContent=kind==='complete'?'O que confirma a conclusão?':kind==='archive'?'Motivo (ex.: duplicado do chamado R-…)':kind==='resolve'?'Como a pendência foi resolvida?':kind==='profile'?'Observação ou correção técnica':'Descrição';
  $('date-label').textContent=kind==='complete'?'Data real da conclusão':'Data real da atualização';
  $('edit-note').parentElement.hidden=['restore','merge'].includes(kind);
  $('duplicate-field').hidden=kind!=='merge';$('duplicate-code').required=kind==='merge';$('duplicate-code').value='';
  if(kind==='archive')$('edit-note').maxLength=1000;
  $('form-error').hidden=true;configureForm();$('edit-dialog').showModal();
}
function configureForm(){if(!editing)return;const required=!['archive','restore','merge'].includes(editing.kind)&&(editing.kind!=='profile'||$('edit-status').value!==editing.status);$('date-field').hidden=!required;$('edit-day').required=required;$('edit-note').required=required||editing.kind==='archive';}
$('edit-status').onchange=configureForm;
for(const id of ['cancel','cancel-top'])$(id).onclick=()=>$('edit-dialog').close();
$('edit-dialog').onclose=()=>{editing=null;};
$('edit-form').onsubmit=async e=>{
  e.preventDefault();if(!editing)return;
  const {kind,version,code,task}=editing,occurredOn=$('edit-day').value,note=$('edit-note').value;
  const payload=kind==='archive'?{kind,version,text:note}:kind==='restore'?{kind,version}:kind==='merge'?{kind,version,duplicate:$('duplicate-code').value.trim().toUpperCase()}:kind==='complete'?{kind:'profile',version,area:detail.profile.area,title:detail.profile.title,status:'completed',note,occurredOn}:kind==='profile'?{kind,version,area:$('edit-area').value||null,title:$('edit-title').value,status:$('edit-status').value,location:$('edit-location').value,serviceDay:$('edit-service-day').value,note,occurredOn}:{kind,version,text:note,occurredOn,...(task?{taskId:task.id}:{})};
  if(kind==='merge'&&!confirm('Reunir as fontes de '+payload.duplicate+' em '+code+' e arquivar o cadastro duplicado?'))return;
  $('save').disabled=true;
  try{detail=await api('/'+code,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});$('edit-dialog').close();renderDetail();await refresh();notify('Alteração salva no painel. Nenhuma mensagem enviada.');}
  catch(e){$('form-error').textContent=e.message;$('form-error').hidden=false;}
  finally{$('save').disabled=false;}
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
$('month').value=day.format(new Date()).slice(0,7);
$('month').onchange=$('carry').onchange=()=>void refresh();
$('archived').onchange=()=>void refresh();
$('sort').onchange=()=>renderList();
function monthLinks(){for(const [id,route] of [['closing-link','/fechamento'],['history-link','/historico']])$(id).href=route+'?month='+encodeURIComponent($('month').value);}
$('month').addEventListener('change',monthLinks);monthLinks();
$('search').oninput=$('filter').onchange=renderList;
$('refresh').onclick=()=>{void refresh(true);void pulse();};
window.addEventListener('hashchange',()=>{const code=codeFromHash();if(code&&!editing)void openCase(code);});
void refresh();void pulse();setInterval(()=>{if(!document.hidden){void refresh();void pulse();}},15000);
