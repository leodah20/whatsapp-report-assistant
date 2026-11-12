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

const accessForm=document.getElementById('access-form'), accessLogin=document.getElementById('access-login');
const accessRole=document.getElementById('access-role'), accessSave=document.getElementById('access-save');
const accessList=document.getElementById('access-list'), accessStatus=document.getElementById('access-status');
const roleLabels={viewer:'Somente leitura',editor:'Pode editar chamados'};
async function accessRequest(input){
  const response=await fetch('/api/panel/access',{signal:AbortSignal.timeout(10000),...(input?
    {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)}:{})});
  if(!response.ok){
    const data=await response.json().catch(()=>null);
    throw Error(data?.error||'Gerenciamento de acessos indisponível.');
  }
  return response.json();
}
async function loadAccess(){
  const users=await accessRequest();
  accessList.replaceChildren(...users.map(({login,role})=>{
    const row=document.createElement('li'), label=document.createElement('span');
    label.textContent=login+' · '+roleLabels[role];
    const edit=document.createElement('button'), revoke=document.createElement('button');
    edit.type=revoke.type='button';edit.className=revoke.className='button outline';
    edit.textContent='Alterar';revoke.textContent='Revogar';
    edit.onclick=()=>{accessLogin.value=login;accessRole.value=role;accessRole.focus();};
    revoke.onclick=async()=>{
      if(!confirm('Revogar acesso de '+login+'?'))return;
      revoke.disabled=true;
      try{await accessRequest({login,role:null});await loadAccess();accessStatus.textContent='Acesso revogado.';}
      catch(error){accessStatus.textContent=error.message;revoke.disabled=false;}
    };
    row.append(label,edit,revoke);return row;
  }));
  return users.length;
}
accessForm.onsubmit=async event=>{
  event.preventDefault();accessSave.disabled=true;
  try{
    await accessRequest({login:accessLogin.value.trim(),role:accessRole.value});
    await loadAccess();accessForm.reset();accessStatus.textContent='Permissão salva.';
  }catch(error){accessStatus.textContent=error.message;}
  finally{accessSave.disabled=false;}
};
void loadAccess().then(count=>{
  accessSave.disabled=false;
  accessStatus.textContent=count?'':'Nenhum colaborador cadastrado.';
}).catch(error=>{accessStatus.textContent=error.message;});
