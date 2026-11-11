const el=id=>document.getElementById(id);let lastGroups='';
function notify(message){el('notice').textContent=message;el('notice').hidden=false;}
async function post(path,data={}){const r=await fetch('/api/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const result=await r.json();if(!r.ok)throw Error(result.error||'Falha');return result;}
async function action(fn){try{await fn();await refresh();}catch(e){notify(e.message);}}
el('connect').onclick=()=>action(async()=>{if(!el('consent').checked)throw Error('Confirme a autorização antes de vincular.');await post('connect',{consent:true});});
el('select').onclick=()=>action(async()=>{const option=el('groups').selectedOptions[0];if(!option?.value)throw Error('Escolha o grupo.');if(!confirm('Arquivar somente o grupo “'+option.textContent+'”?'))return;await post('select',{id:option.value});notify('Grupo fixado. Captura de novas mensagens ativada.');});
el('pause').onclick=()=>action(()=>post('pause'));
el('history').onclick=()=>action(async()=>{await post('history',{month:el('month').value});notify('Importação do mês iniciada. O painel acompanha a contagem.');});
el('month').value=new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'}).slice(0,7);
el('view').onclick=()=>action(async()=>{const r=await fetch('/api/month?month='+encodeURIComponent(el('month').value));const data=await r.json();if(!r.ok)throw Error(data.error);el('messages').replaceChildren();for(const m of data.messages){const div=document.createElement('div');div.className='record';const small=document.createElement('small');small.textContent=new Date(m.timestamp*1000).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})+' · '+m.type+' · mídia: '+m.mediaState;const text=document.createElement('p');text.textContent=m.text||'[Mensagem sem texto; precisa de contexto ou análise da mídia]';div.append(small,text);el('messages').append(div);}});
const number=new Intl.NumberFormat('pt-BR');
const metric=(id,value,backlog=false)=>{
  const cell=el(id);
  cell.textContent=Number.isFinite(value)?number.format(value):'—';
  cell.classList.toggle('attention',backlog&&value>0);
};
const scanLabels={loading:'Buscando mensagens após a reconexão',done:'Última busca concluída',error:'Busca pendente de nova tentativa'};
function showAssistant(a,recovery){
  const known=typeof a?.enabled==='boolean';
  const status=el('assistant-status');
  const label=!known?'Estado do assistente indisponível':a.enabled?'Envios automáticos autorizados':'Envios automáticos pausados';
  if(status.textContent!==label)status.textContent=label;
  status.classList.toggle('green',known&&a.enabled);
  status.classList.toggle('amber',known&&!a.enabled);
  el('assistant-activity').textContent=!known?'':a.busy?'Análise em andamento':'Sem análise em andamento';
  el('assistant-metrics').hidden=!known;
  metric('assistant-pending',a?.pending,true);
  metric('assistant-confirmations-pending',a?.confirmationsPending,true);
  metric('assistant-recovery-pending',recovery?.pending,true);
  metric('assistant-items',a?.items);
  metric('assistant-intakes',a?.newCallsConfirmed);
  metric('assistant-confirmations-sent',a?.confirmationsSent);
  el('assistant-recovery-row').hidden=!recovery?.enabled;
  const recoveryNote=el('assistant-recovery');
  recoveryNote.hidden=!known||!recovery?.enabled;
  const phase=recovery?.scan?.phase;
  recoveryNote.textContent='Retomada automática: '+(phase?(Object.hasOwn(scanLabels,phase)?scanLabels[phase]:'Estado da busca indisponível'):'Aguardando conexão para buscar mensagens');
  const notices=el('assistant-notices');
  const messages=[...new Set([a?.error,a?.confirmationError,recovery?.error].filter(Boolean))];
  notices.replaceChildren(...messages.map(message=>{
    const item=document.createElement('li');item.textContent=message;return item;
  }));
  notices.hidden=!messages.length;
}
async function refresh(){
  try{
    const r=await fetch('/api/status');
    if(r.status===401){location.reload();return;}
    if(!r.ok)throw Error('Estado indisponível');
    const data=await r.json(),job=data.importJob;
    const checked=data.lastTransportCheck?' · conexão verificada às '+new Date(data.lastTransportCheck).toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo'}):'';
    el('status').textContent='Estado: '+data.state+(data.error?' — '+data.error:'')+checked;
    el('scope').textContent=data.groupName?'Grupo: '+data.groupName+' · '+(data.paused?'captura pausada':'captura ativa'):'Nenhum grupo autorizado ainda.';
    el('count').textContent=data.count;
    el('instructions').hidden=!data.hasQr;
    el('connect').disabled=!['desconectado','erro','falha-autenticacao'].includes(data.state);
    if(data.qr){
      let img=el('qr').querySelector('img');
      if(!img){img=document.createElement('img');img.alt='QR Code de vinculação — não compartilhe';el('qr').append(img);}
      img.src=data.qr;
    }else el('qr').replaceChildren();
    const signature=JSON.stringify(data.groups);
    if(signature!==lastGroups){
      lastGroups=signature;
      el('groups').replaceChildren(new Option('Selecione o grupo autorizado',''));
      for(const g of data.groups)el('groups').add(new Option(g.name,g.id));
      const match=data.groups.find(g=>g.name===data.groupName);
      if(match)el('groups').value=match.id;
    }
    if(job)el('import-status').textContent='Importação '+job.month+': '+job.phase+' · '+(job.archived??job.processed??0)+' registros · mídias '+JSON.stringify(job.mediaStates||{});
    showAssistant(data.assistant,data.recovery);
  }catch{
    el('status').textContent='Coletor indisponível. Reabra o programa local.';
    showAssistant();
  }
}
el('questions-pause').onclick=()=>action(()=>post('questions',{enabled:false}));
el('questions-resume').onclick=()=>action(()=>post('questions',{enabled:true}));
el('cases-view').onclick=()=>action(async()=>{const r=await fetch('/api/assistant');if(!r.ok)throw Error('Consulta indisponível');const data=await r.json();el('cases').replaceChildren();for(const item of data.items){const box=document.createElement('div');box.className='record';const title=document.createElement('strong');title.textContent=item.code+' · '+item.review;const p=document.createElement('p');p.textContent=item.facts.map(f=>f.quote).filter((x,n,a)=>a.indexOf(x)===n).join(' ');const small=document.createElement('small');small.textContent=item.answerIds.length+' respostas vinculadas · campos pendentes: '+item.missing.join(', ')+' · envio: '+item.questionState;box.append(title,p,small);el('cases').append(box);}});
refresh();setInterval(refresh,3000);
