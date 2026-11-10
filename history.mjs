export function bounds(month){
  if(!/^20\d\d-(0[1-9]|1[0-2])$/.test(month))throw Error('Mês inválido');
  const [year,m]=month.split('-').map(Number);
  const next=m===12?`${year+1}-01`:`${year}-${String(m+1).padStart(2,'0')}`;
  return {start:Date.parse(month+'-01T00:00:00-03:00')/1000,end:Date.parse(next+'-01T00:00:00-03:00')/1000};
}

export async function collectMonth(client,groupId,month,progress){
  const range=bounds(month);let info=null,pages=0,stalls=0,lastOldest=Infinity;
  for(;pages<2000;pages++){
    info=await client.pupPage.evaluate(async({groupId,start})=>{
      const chats=window.require('WAWebCollections').Chat.getModelsArray();
      const chat=chats.find(c=>(c.id?._serialized||c.id?.['$1'])===groupId);
      if(!chat)throw Error('Grupo não está sincronizado');
      let messages=chat.msgs.getModelsArray().filter(m=>!m.isNotification);
      const before=messages.length?Math.min(...messages.map(m=>Number(m.t))):null;
      let loadedCount=null;
      if(before===null||before>=start){
        const loaded=await window.require('WAWebChatLoadMessages').loadEarlierMsgs({chat});
        loadedCount=loaded?.length||0;
      }
      messages=chat.msgs.getModelsArray().filter(m=>!m.isNotification);
      return {cached:messages.length,oldest:messages.length?Math.min(...messages.map(m=>Number(m.t))):null,newest:messages.length?Math.max(...messages.map(m=>Number(m.t))):null,loadedCount};
    },{groupId,start:range.start});
    progress({phase:'loading',pages:pages+1,...info});
    if(info.oldest!==null&&info.oldest<range.start)break;
    if(info.loadedCount===0)break;
    if(info.oldest>=lastOldest)stalls++;else stalls=0;
    if(stalls>=3)break;
    lastOldest=info.oldest??Infinity;
  }
  const result=await client.pupPage.evaluate(({groupId,start,end})=>{
    const chat=window.require('WAWebCollections').Chat.getModelsArray().find(c=>(c.id?._serialized||c.id?.['$1'])===groupId);
    const messages=chat.msgs.getModelsArray().filter(m=>!m.isNotification&&Number(m.t)>=start&&Number(m.t)<end).sort((a,b)=>a.t-b.t);
    let errors=0;
    const data=[];
    for(const message of messages){try{data.push(window.WWebJS.getMessageModel(message));}catch{errors++;}}
    return {data,errors,found:messages.length};
  },{groupId,...range});
  return {...result,coverage:{...info,pages:pages+1,boundaryReached:info?.oldest!==null&&info?.oldest<range.start,historyExhausted:info?.loadedCount===0,stalled:stalls>=3,month}};
}
