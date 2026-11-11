import {CaseError} from './board.mjs';

export const HISTORY_MEDIA_LIMIT=100*1024*1024;
const types={
  'image/jpeg':'image','image/png':'image','image/webp':'image','image/gif':'image',
  'video/mp4':'video','video/webm':'video','video/ogg':'video',
  'audio/ogg':'audio','audio/opus':'audio','audio/mpeg':'audio','audio/mp4':'audio','audio/aac':'audio','audio/wav':'audio','audio/webm':'audio'
};
const extensions={'image/jpeg':'jpg','audio/mpeg':'mp3','audio/mp4':'m4a'};
const mimeOf=source=>String(source.mime||'').split(';',1)[0].trim().toLowerCase();
export function historyMediaKind(source){
  const mime=mimeOf(source);
  return Object.hasOwn(types,mime)?types[mime]:'download';
}
function span(range,size){
  const match=/^bytes=(\d{0,16})-(\d{0,16})$/.exec(range);
  if(!match||!size||!match[1]&&!match[2])return null;
  const start=match[1]?Number(match[1]):Math.max(0,size-Number(match[2]));
  const end=match[1]&&match[2]?Math.min(size-1,Number(match[2])):size-1;
  return Number.isSafeInteger(start)&&Number.isSafeInteger(end)&&start<=end&&start<size?[start,end]:null;
}
export function sendHistoryMedia(req,res,source,readMedia,download){
  const data=readMedia(source.id,HISTORY_MEDIA_LIMIT);
  if(!data?.length||data.length>HISTORY_MEDIA_LIMIT)throw new CaseError('Anexo indisponível no arquivo local.',404);
  const mime=mimeOf(source),attachment=download||!Object.hasOwn(types,mime);
  res.setHeader('Content-Security-Policy',"sandbox; default-src 'none'");
  res.setHeader('Cross-Origin-Resource-Policy','same-origin');
  res.setHeader('Content-Type',attachment?'application/octet-stream':mime);
  res.setHeader('Accept-Ranges','bytes');
  if(attachment){
    const name=String(source.filename||'').split(/[/\\]/).at(-1).replace(/[^a-z0-9_. -]/gi,'_').slice(0,150).replace(/^[. ]+|[. ]+$/g,'');
    const ext=Object.hasOwn(types,mime)?(extensions[mime]||mime.split('/')[1]):'';
    res.setHeader('Content-Disposition','attachment; filename="'+(name||('anexo'+(ext?'.'+ext:'')))+'"');
  }
  if(req.headers.range){
    const range=span(req.headers.range,data.length);
    if(!range){res.writeHead(416,{'Content-Range':'bytes */'+data.length});res.end();return;}
    const [start,end]=range;
    res.writeHead(206,{'Content-Range':`bytes ${start}-${end}/${data.length}`,'Content-Length':end-start+1});
    res.end(data.subarray(start,end+1));return;
  }
  res.writeHead(200,{'Content-Length':data.length});res.end(data);
}
