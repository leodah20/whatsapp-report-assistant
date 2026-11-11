import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export function seal(key, value, aad) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm',key,iv);
  cipher.setAAD(Buffer.from(aad));
  return Buffer.concat([iv,cipher.update(value),cipher.final(),cipher.getAuthTag()]);
}
export function open(key, value, aad) {
  const data = Buffer.from(value);
  if(data.length < 28) throw new Error('Arquivo inválido');
  const cipher = createDecipheriv('aes-256-gcm',key,data.subarray(0,12));
  cipher.setAAD(Buffer.from(aad)); cipher.setAuthTag(data.subarray(-16));
  return Buffer.concat([cipher.update(data.subarray(12,-16)),cipher.final()]);
}
export function groupOf(message) { return message.fromMe ? message.to : message.from; }
export function inScope(message, groupId, paused) {
  return !paused && !!groupId && groupId.endsWith('@g.us') && groupOf(message) === groupId && !message.isStatus;
}
export function monthOf(seconds) {
  if(!Number.isFinite(seconds) || seconds < 0 || seconds > Date.now()/1000+86400) throw new Error('Data inválida');
  const parts = new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit'}).formatToParts(new Date(seconds*1000));
  return parts.find(x=>x.type==='year').value+'-'+parts.find(x=>x.type==='month').value;
}
export function recordOf(m) {
  if(typeof m.id?._serialized !== 'string' || m.id._serialized.length > 500) throw new Error('ID inválido');
  const timestamp = Number(m.timestamp);
  return {id:m.id._serialized,timestamp,month:monthOf(timestamp),text:String(m.body||'').slice(0,30000),type:String(m.type||''),fromMe:!!m.fromMe,hasMedia:!!m.hasMedia,hasQuotedMsg:!!m.hasQuotedMsg,mediaState:m.hasMedia?'pending':'none',review:'unreviewed'};
}
