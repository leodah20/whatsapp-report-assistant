'use strict';
async function updateCollectorStatus(){
  const status=document.getElementById('private-status');
  try{
    const response=await fetch('/api/cases/runtime',{signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw Error();
    const state=await response.json();
    status.textContent=state.requiresLink?'WhatsApp precisa de novo vínculo no computador.':state.paused?'Coleta pausada no computador.':state.connected?'WhatsApp conectado.':'WhatsApp não está conectado.';
  }catch{status.textContent='Não foi possível consultar o coletor. Recarregue esta página.';}
}
void updateCollectorStatus();
