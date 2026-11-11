// Narrow compatibility for WhatsApp's serialized identifier field rename.
// Runs as application code inside its own WhatsApp Web session. Never sends messages.
export async function installIdCompatibility(client){
  return client.pupPage.evaluate(()=>{
    const collections=window.require('WAWebCollections');
    let patched=0;
    const visit=id=>{
      if(!id||typeof id!=='object')return;
      const proto=Object.getPrototypeOf(id);
      if(!proto||proto===Object.prototype||('_serialized' in id)||typeof id['$1']!=='string')return;
      Object.defineProperty(proto,'_serialized',{configurable:true,get(){return this['$1'];}});
      patched++;
    };
    for(const chat of collections.Chat.getModelsArray())visit(chat.id);
    // Inspect identifiers only; do not transfer message contents or other chats.
    for(const message of collections.Msg.getModelsArray().slice(0,30)){
      visit(message.id);visit(message.id?.remote);visit(message.from);visit(message.to);
    }
    const normalize=(value,depth=0)=>{
      if(!value||typeof value!=='object'||depth>3)return value;
      if(!value._serialized&&typeof value['$1']==='string')value._serialized=value['$1'];
      for(const name of ['id','remote','from','to','author','participant']){
        if(value[name]&&typeof value[name]==='object')normalize(value[name],depth+1);
      }
      return value;
    };
    if(!window.WWebJS.__reportIdCompatibility){
      const previous=window.WWebJS.getMessageModel;
      window.WWebJS.getMessageModel=function(message){visit(message.id);visit(message.id?.remote);visit(message.from);visit(message.to);return normalize(previous(message));};
      window.WWebJS.__reportIdCompatibility=true;
    }
    return {patched};
  });
}

export async function groupChoices(client){
  // Avoid serializing private conversations, last messages and participant lists.
  return client.pupPage.evaluate(()=>{
    const result=[];
    for(const chat of window.require('WAWebCollections').Chat.getModelsArray()){
      const id=chat.id?._serialized||chat.id?.['$1'];
      if(typeof id==='string'&&id.endsWith('@g.us'))result.push({id,name:String(chat.formattedTitle||chat.name||'Grupo sem nome')});
    }
    return result;
  });
}
