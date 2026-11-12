'use strict';
async function updateCollectorStatus(){
  const status=document.getElementById('private-status');
  try{
    const response=await fetch('/api/cases/runtime',{signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw Error();
    const state=await response.json();
    status.textContent=state.requiresLink?'WhatsApp precisa de novo vínculo no computador.':state.paused?'Coleta pausada no computador.':state.connected?'WhatsApp conectado.':'WhatsApp não está conectado.';
    const mail=document.getElementById('private-support-status'),s=state.supportMail;
    mail.hidden=!s;
    if(s)mail.textContent='E-mail da Invenzi · '+({ready:'monitorando',syncing:'sincronizando',backlog:'importando o histórico',error:'consulta temporariamente indisponível'}[s.state]||'aguardando')+
      (s.lastRun?' · última consulta '+new Date(s.lastRun).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}):'')+
      (s.needsReview?' · mensagens fora do formato nesta sessão: '+s.needsReview:'');
  }catch{status.textContent='Não foi possível consultar o coletor. Recarregue esta página.';}
}
void updateCollectorStatus();
