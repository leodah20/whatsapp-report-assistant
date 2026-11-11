'use strict';
const $=id=>document.getElementById(id);
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const url=(month,tail='')=>'/api/cases/closing'+tail+'?month='+encodeURIComponent(month);
const local=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'});
const clock=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'});
const stateLabels={unreviewed:'Por revisar',stale:'Fonte atualizada — rever',include:'Incluído',exclude:'Fora da minuta',defer:'Falta resposta'};
const fields={local:'Qual é o local exato?',equipamento:'Qual equipamento foi atendido?',ocorrencia:'O que aconteceu?',procedimento:'O que foi feito de fato?',resultado:'Qual foi o resultado observado ou o que ficou pendente?'};
const fieldLabels={local:'Local',equipamento:'Equipamento',ocorrencia:'Ocorrência',procedimento:'Procedimento',resultado:'Resultado ou pendência'};
const statuses={'':'Sem status',done:'Concluída',pending:'Não concluída',unknown:'Sem confirmação',na:'Não aplicável'};
let view=null,selected=null,serial=0,dirty=false,saving=false,preventivesDirty=false;
let assistMonth='',assistRunning=false,extraction=null,printMode=false,reviewGroup='pending';
const assistPicked=new Set(),localSuggestions=new Map();
const cloudHosts={chatgpt:'chatgpt.com',claude:'claude.ai'};
const localTimeout=920000;
const notify=text=>{$('notice').textContent=text;$('notice').hidden=!text;};
async function request(path,options){const r=await fetch(path,{signal:AbortSignal.timeout(15000),...options});const value=await r.json();if(!r.ok)throw Object.assign(Error(value.error||'Fechamento indisponível.'),{status:r.status});return value;}
function control(parent,label,input){const l=el('label',label,'control');l.append(input);parent.append(l);return input;}
function input(type,value='',max=0){const i=el('input');i.type=type;i.value=value;if(max)i.maxLength=max;return i;}
function textarea(value,max){const i=el('textarea');i.value=value||'';i.maxLength=max;i.rows=4;return i;}
function select(values,value){const s=el('select');s.replaceChildren(...Object.entries(values).map(([k,v])=>new Option(v,k)));s.value=value||'';return s;}
function checkbox(parent,label,checked=false){const l=el('label',undefined,'check'),c=input('checkbox');c.checked=checked;l.append(c,el('span',label));parent.append(l);return c;}
function clearExtraction(){extraction=null;$('assist-text').value='';$('assist-output').hidden=true;}
function renderHistoryPending(count){
  $('history-pending').hidden=$('assist-history-pending').hidden=!count;
  const label=count===1?'1 registro sem chamado neste mês':count+' registros sem chamado neste mês';
  $('history-pending-title').textContent=label;
  $('assist-history-text').textContent=count===1?'1 registro do histórico fica fora deste pacote.':count+' registros do histórico ficam fora deste pacote.';
  const link=$('history-link');$('history-dot').hidden=!count;
  if(count){link.title=label;link.setAttribute('aria-label','Histórico sem chamado: '+label);}
  else{link.removeAttribute('title');link.removeAttribute('aria-label');}
}
function targetURL(provider,value){
  const host=cloudHosts[provider];if(!host||!value.trim())return null;
  try{
    const u=new URL(value.trim()),chat=provider==='claude'?/^\/chat\/[a-f0-9-]+\/?$/i:/^\/(?:g\/[\w-]+\/)?c\/[a-f0-9-]+\/?$/i;
    if(u.protocol==='https:'&&u.host===host&&!u.username&&!u.password&&chat.test(u.pathname))return u.origin+u.pathname;
  }catch{}
  return null;
}
function refreshProvider(){
  const provider=$('assist-provider').value,host=cloudHosts[provider],link=$('assist-open'),entered=$('assist-chat').value;
  const chat=targetURL(provider,entered);
  $('assist-chat-field').hidden=!host;link.hidden=!host;link.href=chat||(host?'https://'+host+'/':'');
  link.textContent=chat?'Abrir conversa escolhida':provider==='claude'?'Abrir Claude':'Abrir ChatGPT';
  if(host&&entered.trim()&&!chat)link.hidden=true;
  $('assist-chat').setCustomValidity(host&&entered.trim()&&!chat?'Use o link privado da conversa no serviço escolhido.':'');
  $('assist-provider-note').textContent=provider==='local'?'O modelo baixado redige uma sugestão por chamado a partir dos textos, sem interpretar fotos ou vídeos. Nada é salvo até você revisar.':
    provider==='export'?'Baixe o pacote ou copie o texto para levar ao chat de sua escolha. O painel não identifica a conversa nem envia dados automaticamente.':
    'O link fica neste navegador. O painel não envia dados: confira a prévia e anexe ou cole a extração na conversa escolhida.';
  $('assist-run').textContent=provider==='local'?'Gerar sugestões locais':$('editor').contains($('report-assist'))?'Gerar extração':'Preparar extração';
}
function refreshSelection(){
  $('assist-count').textContent=assistPicked.size;
  $('assist-run').disabled=assistRunning||!assistPicked.size||assistPicked.size>100;
  $('print-mode').disabled=assistRunning;
}
function renderAssist(){
  const eligible=view.items.filter(x=>x.state!=='exclude');
  if(assistMonth!==view.month){assistMonth=view.month;assistPicked.clear();eligible.forEach(x=>assistPicked.add(x.code));localSuggestions.clear();$('assist-results').replaceChildren();clearExtraction();}
  for(const code of assistPicked)if(!eligible.some(x=>x.code===code)){assistPicked.delete(code);clearExtraction();}
  const box=$('assist-cases');box.replaceChildren();
  for(const x of eligible){
    const c=checkbox(box,[x.title,x.location,stateLabels[x.state]].filter(Boolean).join(' · '),assistPicked.has(x.code));
    c.onchange=()=>{if(c.checked)assistPicked.add(x.code);else assistPicked.delete(x.code);clearExtraction();refreshSelection();};
  }
  if(!eligible.length)box.append(el('p','Nenhum chamado disponível neste mês.','hint'));
  refreshSelection();
}
const assistRequest=(month,tail,codes,timeout=15000)=>request(url(month,tail),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({codes}),signal:AbortSignal.timeout(timeout)});
async function runAssist(){
  if(assistRunning||!view||!assistPicked.size||assistPicked.size>100)return;
  if(preventivesDirty){$('assist-status').textContent='Salve os status alterados em Preventivas do mês antes de gerar a extração.';return;}
  const provider=$('assist-provider').value,month=view.month,version=view.version,codes=[...assistPicked];
  if(provider!=='local'&&!$('assist-chat').reportValidity())return;
  assistRunning=true;clearExtraction();$('assist-cases').disabled=$('assist-provider').disabled=true;refreshSelection();
  $('assist-status').textContent=provider==='local'?'Iniciando a redação local…':'Organizando o contexto…';
  try{
    if(provider!=='local'){
      const packet=await assistRequest(month,'/context',codes);
      if(view?.month!==month||view.version!==version)throw Error('A revisão mudou. Prepare a extração novamente.');
      if(Number.isInteger(packet.unlinkedCount)){view.unlinkedCount=packet.unlinkedCount;renderHistoryPending(view.unlinkedCount);}
      extraction={month,codes,fingerprint:packet.fingerprint};
      $('assist-text').value=packet.text;
      $('assist-output').hidden=false;
      $('assist-status').textContent='Extração pronta: '+packet.attachments+' anexos selecionados.'+(packet.pendingReview?' '+packet.pendingReview+' chamado(s) sem conferência atual das fontes; suas mídias não entram no ZIP até serem confirmadas.':'')+' Nenhum dado foi enviado. Se a conversa não abrir ZIP, extraia o TXT e os anexos para compartilhar.';
    }else{
      const results=$('assist-results');results.replaceChildren();let errors=0;
      for(const [index,code] of codes.entries()){
        if(view?.month!==month)return;
        const row=view.items.find(i=>i.code===code);
        $('assist-status').textContent='Redigindo localmente: '+(index+1)+' de '+codes.length+'…';
        try{
          const suggestion=await assistRequest(month,'/local',[code],localTimeout);
          if(view?.month!==month)return;
          localSuggestions.set(code,{...suggestion,stamp:row.stamp});
          const card=el('details',undefined,'report-suggestion');card.append(el('summary',row.title));
          if(suggestion.narrative)card.append(el('p',suggestion.narrative,'evidence'));
          for(const q of suggestion.questions)card.append(el('p',q,'hint'));
          if(suggestion.limited)card.append(el('p','Parte das fontes não coube no modelo. Consulte a extração completa.','hint'));
          const open=el('button','Revisar chamado','button outline');open.type='button';
          open.onclick=()=>{if(!saving&&(!dirty||confirm('Descartar alterações não salvas?')))void openCase(code);};
          card.append(open);results.append(card);
        }catch(e){errors++;results.append(el('p',(row?.title||code)+': '+e.message,'notice'));if(e.status===503||e.status===409||e.name==='TimeoutError')break;}
      }
      $('assist-status').textContent=errors?'Geração finalizada com avisos. Confira os resultados abaixo.':'Sugestões prontas. Revise os chamados antes de salvar.';
    }
  }catch(e){$('assist-status').textContent=e.message;}
  finally{assistRunning=false;$('assist-cases').disabled=$('assist-provider').disabled=false;refreshSelection();}
}
function setupAssist(){
  const provider=$('assist-provider'),chat=$('assist-chat');
  const storageKey=()=> 'report-conversation:'+provider.value;
  provider.onchange=()=>{chat.value='';try{chat.value=localStorage.getItem(storageKey())||'';}catch{}refreshProvider();};
  chat.oninput=()=>{refreshProvider();const target=targetURL(provider.value,chat.value);try{if(target)localStorage.setItem(storageKey(),target);else localStorage.removeItem(storageKey());}catch{}};
  $('assist-run').onclick=()=>void runAssist();
  $('assist-copy').onclick=async()=>{try{await navigator.clipboard.writeText($('assist-text').value);$('assist-status').textContent='Extração copiada. Cole na conversa escolhida.';}catch{$('assist-text').select();$('assist-status').textContent='Selecione e copie o texto ou baixe o TXT.';}};
  $('assist-download').onclick=()=>{if(extraction)download(new Blob([$('assist-text').value],{type:'text/plain;charset=utf-8'}),'contexto-relatorio-'+extraction.month+'.txt');};
  $('assist-zip').onclick=async()=>{
    const packet=extraction;if(!packet)return;
    const button=$('assist-zip');button.disabled=true;
    try{
      const response=await fetch(url(packet.month,'/package'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({codes:packet.codes,fingerprint:packet.fingerprint}),signal:AbortSignal.timeout(120000)});
      if(!response.ok)throw Error((await response.json()).error||'Pacote indisponível.');
      const file=await response.blob();if(extraction===packet)download(file,'contexto-relatorio-'+packet.month+'.zip');
    }catch(e){$('assist-status').textContent=e.message;}finally{button.disabled=false;}
  };
  refreshProvider();
}
function download(file,name){const object=URL.createObjectURL(file),a=el('a');a.href=object;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(object),1000);}
function reviewAttachment(code,s,index){
  const url='/api/cases/'+code+'/attachment/'+index;
  const downloadLink=el('a','Baixar anexo');downloadLink.href=url+'?download=1';downloadLink.download='';
  const mime=String(s.mime||'').toLowerCase().split(';',1)[0];
  const kind=/^image\/(png|jpeg|gif|webp)$/.test(mime)?'img':/^video\/(mp4|webm|ogg)$/.test(mime)?'video':/^audio\/(ogg|opus|mpeg|mp4|aac|wav|webm)$/.test(mime)?'audio':null;
  if(!kind)return downloadLink;
  const details=el('details',undefined,'review-attachment'),box=el('div');
  details.append(el('summary',{img:'Ver imagem',video:'Ver vídeo',audio:'Ouvir áudio'}[kind]),box,downloadLink);
  details.ontoggle=()=>{
    if(!details.open){const player=box.querySelector('video,audio');if(player){player.pause();player.removeAttribute('src');player.load();}box.replaceChildren();return;}
    if(box.childNodes.length)return;
    const media=el(kind);if(kind==='img')media.alt='Anexo da fonte '+(index+1);else{media.controls=true;media.preload='metadata';}
    media.onerror=()=>{if(media.isConnected)media.replaceWith(el('p','Prévia indisponível. Tente baixar o anexo.','hint'));};media.src=url;box.append(media);
  };
  return details;
}
function renderMode(){
  $('print-progress').hidden=!printMode;
  $('report-assist').hidden=$('extract-link').hidden=printMode;
  $('settings-link').hidden=$('settings').hidden=!view?.template;
  $('print-settings').hidden=!printMode;
  $('issued').required=printMode;
  $('settings-title').textContent=printMode?'2. Preventivas e emissão':'Preventivas do mês';
  $('settings-link').textContent=printMode?'2. Preventivas e emissão':'Preventivas';
  $('settings-save').textContent=printMode?'Salvar preventivas e emissão':'Salvar preventivas';
  for(const status of $('preventives').querySelectorAll('select'))status.required=printMode;
  $('closing-mode-note').textContent=printMode?'Revisão para impressão':'Extração de contexto e mídias';
  $('closing-lead').textContent=printMode?'Revise o texto, as datas, as fotos e as preventivas para salvar em PDF.':'Confira as fontes e os anexos e gere a extração do mês.';
  $('print-mode').textContent=printMode?'Voltar para extração':'Fechar PDF pelo painel';
  $('review-link').textContent=printMode?'1. Revisar chamados':'Conferir fontes';
  $('review-title').textContent=printMode?'Revisar chamados para o PDF':'Conferir fontes';
  const final=$('editor').querySelector('.final-review');
  if(final)final.hidden=!printMode;
}
function renderOverview(){
  renderAssist();
  renderMode();
  renderHistoryPending(view.unlinkedCount||0);
  for(const a of document.querySelectorAll('[data-month-nav]'))a.href=a.pathname+'?month='+encodeURIComponent(view.month);
  $('counts').textContent=view.archiveCount+' mensagens no arquivo · '+view.items.length+' chamados · '+view.items.filter(x=>x.state==='include').length+' incluídos';
  $('checks').replaceChildren(...(view.checks.length?view.checks:['Revisão registrada. Você já pode abrir a minuta.']).map(x=>el('li',x)));
  $('draft').hidden=!!view.checks.length;
  $('draft').href='/minuta?month='+encodeURIComponent(view.month);
  renderQueue();
}
const searchKey=value=>String(value||'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
const isReviewed=row=>printMode?['include','exclude'].includes(row.state):row.sourceReviewState==='reviewed';
const matchesSearch=(row,query)=>searchKey([row.title,row.location,row.code,row.area].join(' ')).includes(query);
function reviewBadge(row){
  if(!row)return null;
  const stale=printMode?row.state==='stale':row.sourceReviewState==='stale';
  const text=printMode?stateLabels[row.state]:stale?'Fontes atualizadas':isReviewed(row)?'Conferido':'A revisar';
  return el('span',text,'badge '+(isReviewed(row)?'green':stale?'amber':''));
}
function renderQueue({reset=false}={}){
  if(!view)return;
  const list=$('list'),scroll=reset?0:list.scrollTop,query=searchKey($('review-search').value.trim());
  const reviewed=view.items.filter(isReviewed),pending=view.items.filter(x=>!isReviewed(x));
  const groups={pending,done:reviewed};
  for(const key of Object.keys(groups)){
    const button=$('review-'+key);
    button.firstElementChild.textContent=key==='pending'?(printMode?'A decidir':'A revisar'):(printMode?'Decididos':'Conferidos');
    $('review-'+key+'-count').textContent=groups[key].length;
    button.setAttribute('aria-pressed',String(key===reviewGroup));
  }
  const name=$('review-'+reviewGroup).firstElementChild.textContent;
  list.setAttribute('aria-label','Chamados — '+name);
  const visible=groups[reviewGroup].filter(row=>matchesSearch(row,query));
  list.replaceChildren(...visible.map(x=>{
    const b=el('button',undefined,'case-card');b.type='button';b.setAttribute('aria-current',String(selected===x.code));
    b.dataset.code=x.code;
    const code=el('div',undefined,'card-head');code.append(el('span',x.code,'case-code'));
    if(x.carryover)code.append(el('span','Mês anterior','hint'));
    const tags=el('div',undefined,'badges');tags.append(reviewBadge(x));
    if(x.stageLabel)tags.append(el('span',x.stageLabel,'badge stage-badge stage-'+x.status));
    b.append(code,el('h3',x.title),el('span',x.location?(x.locationConfirmed?x.location:'Local sugerido: '+x.location):'Local a confirmar','case-location'),tags);
    b.onclick=()=>{if(!saving&&(!dirty||confirm('Descartar alterações não salvas?')))void openCase(x.code);};return b;
  }));
  if(!visible.length)list.append(el('p',query?'Nenhum chamado encontrado nesta lista.':
    !view.items.length?'Nenhum chamado localizado nesta competência.':
    reviewGroup==='done'?(printMode?'Nenhuma decisão registrada ainda.':'Nenhum chamado conferido ainda.'):
      printMode?'Todos os chamados foram decididos.':'Tudo conferido. Abra Conferidos para revisar novamente.','hint review-empty'));
  list.scrollTop=scroll;
  const current=$('editor').querySelector('.review-current-badge'),row=view.items.find(x=>x.code===selected);
  if(current&&row)current.replaceChildren(reviewBadge(row));
}
function focusCase(){
  const editor=$('editor'),heading=editor.querySelector('.review-editor-head h2');
  editor.scrollTop=0;
  const top=editor.getBoundingClientRect().top;
  if(matchMedia('(max-width: 720px)').matches||top<0||top>36)editor.scrollIntoView({block:'start'});
  heading?.focus({preventScroll:true});
}
function restoreAssist(){
  const assist=$('report-assist'),home=$('assist-home');
  if(assist.parentElement!==home){home.append(assist);refreshProvider();}
}
function resetEditor(){
  restoreAssist();
  $('editor').replaceChildren(el('h2','Selecione um chamado'),el('p','O contexto e os anexos aparecem aqui.','hint'));
}
function finishReview(focus=true){
  selected=null;renderQueue();
  const editor=$('editor'),intro=el('header',undefined,'review-editor-head review-finished'),copy=el('div');
  const title=el('h2','Todos os chamados conferidos');title.tabIndex=-1;
  copy.append(title,el('p','A extração pode ser gerada aqui mesmo.','hint'));
  if(view.template){
    const preventive=el('a','Conferir preventivas do mês');preventive.href='#settings';copy.append(preventive);
  }
  intro.append(copy);
  editor.replaceChildren(intro,$('report-assist'));
  refreshProvider();
  if(focus)focusCase();
}
const reviewIsDone=()=>!!view?.items.length&&view.items.every(row=>row.sourceReviewState==='reviewed');
async function advanceReview(code){
  if(reviewIsDone()){finishReview();return;}
  const rows=view.items,index=rows.findIndex(x=>x.code===code);
  const next=[...rows.slice(index+1),...rows.slice(0,index+1)].find(x=>x.sourceReviewState!=='reviewed');
  if(!next)return;
  if(!matchesSearch(next,searchKey($('review-search').value.trim()))){$('review-search').value='';renderQueue({reset:true});}
  await openCase(next.code);
}
function backToQueue(){
  const queue=$('review'),list=$('list'),active=[...list.querySelectorAll('.case-card')].find(b=>b.dataset.code===selected);
  queue.scrollIntoView({block:'start'});
  if(active){
    const bounds=list.getBoundingClientRect(),card=active.getBoundingClientRect();
    if(card.top<bounds.top)list.scrollTop+=card.top-bounds.top-3;
    else if(card.bottom>bounds.bottom)list.scrollTop+=card.bottom-bounds.bottom+3;
  }
  (active||$('review-'+reviewGroup)).focus({preventScroll:true});
}
function renderSettings(){
  if(!view.template)return;
  $('issued').value=view.settings?.issued||'';$('issued').max=local.format(new Date());
  $('observations').value=view.settings?.observations||'';$('coverage').checked=view.settings?.coverage===view.coverage;
  let index=0;
  $('preventives').replaceChildren(...view.template.groups.map(g=>{
    const group=el('details',undefined,'preventive-group'),fieldset=el('fieldset');
    const label=el('summary',g.name),count=el('span',undefined,'hint');label.append(count);group.append(label,fieldset);
    for(const [week,task,category] of g.rows){
      const s=select(statuses,view.settings?.statuses[index++]);s.required=printMode;s.name='preventive';
      const l=el('label',undefined,'preventive-row');l.append(el('span',task+' · '+category+(week?' · Semana '+week:'')),s);fieldset.append(l);
    }
    const update=()=>{count.textContent=[...fieldset.elements].filter(s=>s.value).length+'/'+g.rows.length+' revisadas';};
    fieldset.addEventListener('change',update);update();
    return group;
  }));
}
async function load(month){
  if(saving||assistRunning||(dirty||preventivesDirty)&&!confirm('Descartar alterações não salvas?'))return;
  const n=++serial;
  try{
    const next=await request(url(month));if(n!==serial)return;
    view=next;selected=null;dirty=false;preventivesDirty=false;reviewGroup='pending';$('review-search').value='';$('list').scrollTop=0;
    history.replaceState(null,'','/fechamento?month='+encodeURIComponent(month));
    resetEditor();renderOverview();renderSettings();notify('');
    if(!printMode&&reviewIsDone())finishReview(false);
  }catch(e){if(n===serial)notify(e.message);}
}
async function openCase(code){
  const n=++serial,month=view.month;
  try{
    const d=await request('/api/cases/'+code);if(n!==serial||view.month!==month)return;
    selected=code;dirty=false;renderOverview();
    const row=view.items.find(x=>x.code===code),r=row.review||{};
    const title=el('h2',d.title),form=el('form'),evidence=el('section',undefined,'source-review');
    title.tabIndex=-1;
    const headingBar=el('header',undefined,'review-editor-head'),headingText=el('div'),currentBadge=el('div',undefined,'review-current-badge');
    const back=el('button','Voltar à lista','button outline compact review-back');back.type='button';back.onclick=backToQueue;
    currentBadge.append(reviewBadge(row));
    headingText.append(el('span',d.code,'case-code'),title);
    if(d.location)headingText.append(el('p',d.location,'hint'));
    headingText.append(currentBadge);headingBar.append(headingText,back);
    evidence.append(el('h3','Contexto para a extração'),el('p','Confira os dados abaixo e marque os anexos que devem entrar no pacote.','hint'));
    if(row.stageLabel)evidence.append(el('p',[row.stageLabel,d.stage?.reason].filter(Boolean).join(' — '),'evidence'));
    for(const task of d.profile.tasks||[])if(!task.resolvedAt)evidence.append(el('p','Pendência: '+task.text,'hint'));
    const facts=el('dl',undefined,'facts');
    for(const f of d.facts||[]){
      const line=el('div');line.append(el('dt',(fieldLabels[f.field]||f.field)+(f.confirmed?' · confirmado':' · extraído da fonte')),el('dd',f.quote));facts.append(line);
    }
    evidence.append(facts);
    const sources=el('details');sources.open=true;sources.append(el('summary','Mensagens e anexos ('+d.sources.length+')'));
    const attachments=[];
    d.sources.forEach((s,index)=>{
      const record=el('article',undefined,'record');
      record.append(el('p','Fonte '+(index+1)+' · '+clock.format(new Date(s.timestamp*1000)),'hint'),el('p',s.text||(s.hasMedia?'Sem legenda.':'Mensagem sem texto.'),'evidence'));
      if(s.hasMedia&&s.mediaState==='saved'){
        const checked=row.sourceReviewState==='reviewed'?row.sourceReview.attachments.includes(index):true;
        const choice=checkbox(record,'Incluir este anexo no pacote',checked);attachments.push([index,choice]);record.append(reviewAttachment(code,s,index));
      }else if(s.hasMedia)record.append(el('p','Anexo não disponível no arquivo local.','hint'));
      sources.append(record);
    });
    evidence.append(sources);
    if(d.profile.events.some(e=>e.text)){
      const updates=el('details');updates.append(el('summary','Atualizações locais'));
      for(const e of d.profile.events)if(e.text)updates.append(el('p',(e.occurredOn||'Atualização sem data de atendimento')+' — '+e.text,'evidence'));
      evidence.append(updates);
    }
    const sourceSave=el('button','Confirmar fontes e anexos','button primary');sourceSave.type='button';
    const sourceNote=el('p',row.sourceReviewState==='reviewed'?'Fontes já conferidas.':row.sourceReviewState==='stale'?'As fontes mudaram desde a última conferência.':'Fontes ainda não conferidas.','hint');
    sourceNote.setAttribute('role','status');
    const markSources=()=>{dirty=true;sourceNote.textContent='Seleção alterada. Confirme para incluir no pacote.';};
    for(const [,choice] of attachments)choice.addEventListener('change',markSources);
    sourceSave.onclick=async()=>{
      const autoAdvance=!printMode&&reviewGroup==='pending'&&!formDirty&&view.items.find(x=>x.code===code)?.sourceReviewState!=='reviewed';
      if(await saveData({kind:'sources',code,stamp:row.stamp,attachments:attachments.filter(([,c])=>c.checked).map(([i])=>i)},sourceSave)){
        if(!formDirty)dirty=false;sourceNote.textContent='Fontes e anexos conferidos. Já podem entrar na extração.';
        if(autoAdvance&&!printMode&&reviewGroup==='pending'&&selected===code)await advanceReview(code);
      }
    };
    evidence.append(sourceSave,sourceNote);
    const context=el('p',row.state==='stale'?'Há informação nova. Reconfirme o texto e as imagens.':d.missing.length?d.missing.map(k=>fields[k]).filter(Boolean).join(' '):'Confira se o texto distingue execução, resultado observado e pendência.','notice');
    const decision=control(form,'Decisão para o PDF',select({'':'Selecione uma decisão',include:'Incluir na minuta',exclude:'Não incluir no PDF',defer:'Aguardar contexto'},r.decision||''));
    decision.required=true;
    const body=el('div'),reasonWrap=el('div');
    const reason=control(reasonWrap,'O que falta confirmar ou por que não incluir?',textarea(r.reason,1000));
    const heading=control(body,'Título técnico',input('text',r.title||d.title,180));
    const historical=checkbox(body,'Acompanhamento sem nova intervenção datada neste mês',r.historical);
    const dates=el('div',undefined,'date-row');
    const start=control(dates,'Data real do atendimento',input('date',r.start||(d.serviceDay?.startsWith(month+'-')?d.serviceDay:'')));
    const end=control(dates,'Fim do período, se aplicável',input('date',r.end||''));
    start.max=end.max=local.format(new Date());body.append(dates);
    const narrative=control(body,'Texto corrido para a minuta',textarea(r.narrative,3400));
    const pictures=el('fieldset'),gallery=el('div',undefined,'photo-list'),media=[];
    pictures.append(el('legend','Fotos correspondentes (opcional)'),gallery);
    d.sources.forEach((s,index)=>{
      if(s.mediaState!=='saved'||!/^image\/(jpeg|png|webp)(;|$)/.test(s.mime||''))return;
      const img=el('img');img.loading='lazy';img.alt='Evidência '+(index+1);img.src='/api/cases/'+code+'/media/'+index;
      const c=checkbox(gallery,'Foto '+(index+1),row.state!=='stale'&&r.photos?.includes(index));
      c.parentElement.prepend(img);media.push([index,c]);
    });
    if(!media.length)gallery.append(el('p','Nenhuma imagem arquivada para este chamado.','hint'));
    body.append(pictures);
    const verified=checkbox(body,'Conferi a data, o procedimento, o desfecho ou pendência e as fotos. O texto não assume causa nem normalização sem evidência.');
    const suggestion=localSuggestions.get(code);
    if(suggestion&&suggestion.stamp===row.stamp&&suggestion.narrative){
      const use=el('button','Inserir sugestão da IA local','button outline');use.type='button';
      use.onclick=()=>{if(narrative.value.trim()&&!confirm('Substituir o texto atual pela sugestão local?'))return;narrative.value=suggestion.narrative;verified.checked=false;formDirty=dirty=true;narrative.focus();};
      narrative.parentElement.after(use);
    }
    form.append(body,reasonWrap);
    const save=el('button','Salvar decisão','button primary');form.append(save);
    function toggle(){const include=decision.value==='include',needsReason=!!decision.value&&!include;body.hidden=!include;reasonWrap.hidden=!needsReason;reason.required=needsReason;reason.parentElement.firstChild.textContent=decision.value==='exclude'?'Por que este chamado fica fora do PDF?':'O que falta confirmar para incluir no PDF?';heading.required=narrative.required=verified.required=include;dates.hidden=historical.checked;start.required=include&&!historical.checked;}
    decision.onchange=historical.onchange=toggle;toggle();
    let formDirty=false;
    form.oninput=()=>{dirty=true;formDirty=true;};
    form.onsubmit=async e=>{
      e.preventDefault();
      if(!printMode)return;
      const payload=decision.value==='include'?{title:heading.value,start:historical.checked?'':start.value,end:historical.checked?'':end.value,historical:historical.checked,narrative:narrative.value,verified:verified.checked,photos:media.filter(([,c])=>c.checked).map(([index])=>index)}:{reason:reason.value};
      if(await saveData({kind:'review',code,stamp:row.stamp,decision:decision.value,...payload},save)){formDirty=false;dirty=sourceNote.textContent.startsWith('Seleção alterada');notify('Decisão salva. Nenhuma mensagem enviada.');}
    };
    const final=el('details',undefined,'final-review');final.open=true;final.hidden=!printMode;final.append(el('summary','Revisar texto final para impressão'),context,form);
    restoreAssist();$('editor').replaceChildren(headingBar,evidence,final);focusCase();
  }catch(e){if(n===serial)notify(e.message);}
}
async function saveData(payload,button){
  if(!view||saving)return false;
  saving=true;button.disabled=true;
  try{
    view=await request(url(view.month),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({version:view.version,...payload})});
    clearExtraction();
    renderOverview();if(view.settings?.coverage!==view.coverage)$('coverage').checked=false;return true;
  }catch(e){notify(e.message);return false;}
  finally{saving=false;button.disabled=false;}
}
$('period').onsubmit=e=>{e.preventDefault();void load($('month').value);};
window.addEventListener('pageshow',e=>{
  if(!e.persisted||!view)return;
  if(dirty||preventivesDirty||saving||assistRunning){notify('Recarregue a competência após conferir o Histórico para atualizar os chamados.');return;}
  assistMonth='';void load(view.month);
});
$('print-mode').onclick=()=>{
  printMode=!printMode;reviewGroup='pending';$('list').scrollTop=0;
  if(printMode&&$('editor').contains($('report-assist')))resetEditor();
  if(view){renderOverview();if(!printMode&&!selected&&reviewIsDone())finishReview(false);}else renderMode();
};
for(const key of ['pending','done'])$('review-'+key).onclick=()=>{reviewGroup=key;renderQueue({reset:true});};
$('review-search').oninput=()=>renderQueue({reset:true});
$('settings-form').addEventListener('invalid',e=>{const group=e.target.closest('.preventive-group');if(group)group.open=true;},true);
const preventiveValues=()=>[...$('preventives').querySelectorAll('[name=preventive]')].map(x=>x.value);
function updatePreventivesDirty(){
  preventivesDirty=preventiveValues().some((value,index)=>value!==(view?.settings?.statuses?.[index]||''));
  if(preventivesDirty)clearExtraction();
}
$('preventives').addEventListener('change',updatePreventivesDirty);
$('settings-form').onsubmit=async e=>{
  e.preventDefault();
  if(!view?.template)return;
  const statuses=preventiveValues(),pdf=printMode;
  const payload=pdf?{kind:'settings',issued:$('issued').value,statuses,observations:$('observations').value,coverage:$('coverage').checked?view.coverage:null}:{kind:'preventives',templateStamp:view.template.stamp,statuses};
  if(await saveData(payload,e.submitter)){updatePreventivesDirty();notify(pdf?'Preventivas e emissão salvas.':'Preventivas salvas para a extração.');}
};
const given=new URLSearchParams(location.search).get('month');
setupAssist();
$('month').value=/^20\d\d-(0[1-9]|1[0-2])$/.test(given||'')?given:local.format(new Date()).slice(0,7);
void load($('month').value);
