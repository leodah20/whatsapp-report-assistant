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
