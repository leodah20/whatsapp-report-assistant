// Resolve from the authorized group's loaded models, not WhatsApp's changed key parser.
export async function downloadGroupMedia(client,groupId,messageId){
  return client.pupPage.evaluate(async({groupId,messageId})=>{
    const idOf=id=>id?._serialized||id?.['$1'];
    const chat=window.require('WAWebCollections').Chat.getModelsArray().find(c=>idOf(c.id)===groupId);
    if(!chat)throw Error('media:authorized-group-missing');
    const msg=chat.msgs.getModelsArray().find(m=>idOf(m.id)===messageId);
    if(!msg||!msg.mediaData)return null;
    let step='resolve';
    try{
      if(msg.mediaData.mediaStage!=='RESOLVED')await msg.downloadMedia({downloadEvenIfExpensive:true,rmrReason:1});
      if(String(msg.mediaData.mediaStage).includes('ERROR')||['FETCHING','REUPLOADING'].includes(msg.mediaData.mediaStage))return null;
      step='download';
      const mockQpl={addAnnotations(){return this;},addPoint(){return this;}};
      const bytes=await window.require('WAWebDownloadManager').downloadManager.downloadAndMaybeDecrypt({directPath:msg.directPath,encFilehash:msg.encFilehash,filehash:msg.filehash,mediaKey:msg.mediaKey,mediaKeyTimestamp:msg.mediaKeyTimestamp,type:msg.type,mimetype:msg.mimetype,signal:new AbortController().signal,downloadQpl:mockQpl});
      step='encode';
      return {data:await window.WWebJS.arrayBufferToBase64Async(bytes),mimetype:msg.mimetype,filename:msg.filename,filesize:msg.size};
    }catch(e){throw Error(`media:${step}:${String(e?.name||'Error').slice(0,50)}:${String(e?.message||'unknown').replace(/https?:\/\/\S+/g,'[URL]').slice(0,120)}`);}
  },{groupId,messageId});
}
