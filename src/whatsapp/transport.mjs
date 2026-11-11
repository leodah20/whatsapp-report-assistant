export function brokenTransport(error){return !!error?.transportBroken||/detached frame|target closed|session closed|execution context.*destroyed|connection closed|cannot find context|protocol error/i.test(String(error?.message||''));}
export async function verifyTransport(client,timeoutMs=10000){
  let timer;
  try{
    if(!client||client.pupPage?.isClosed?.())throw Error('Página do WhatsApp encerrada');
    const state=await Promise.race([client.getState(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Verificação do WhatsApp sem resposta')),timeoutMs);})]);
    if(state!=='CONNECTED'){const error=Error('Sessão do WhatsApp não conectada');error.reauthRequired=/UNPAIRED|UNLAUNCHED/.test(String(state));throw error;}
    return state;
  }catch(error){error.transportBroken=true;throw error;}
  finally{clearTimeout(timer);}
}

async function bounded(operation,ms){
  let timer;
  try{return await Promise.race([Promise.resolve().then(operation),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Tempo de encerramento excedido')),ms);})]);}
  finally{clearTimeout(timer);}
}

// A detached browser can survive a failed destroy(). Use only the child handle
// returned by this client, never process names, a global browser kill or logout.
export async function closeOwnedClient(client,timeoutMs=8000){
  if(!client)return;
  const child=client.pupBrowser?.process?.();
  try{await bounded(()=>client.destroy(),timeoutMs);}catch{}
  if(!child||child.exitCode!==null||child.signalCode!==null)return;
  let onExit;
  const exited=new Promise(resolve=>{onExit=resolve;child.once('exit',onExit);});
  try{child.kill();await bounded(()=>exited,timeoutMs);}catch{}
  finally{child.off('exit',onExit);}
}
