const normalize=text=>String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const blockers=/\b(aguard\w*|penden\w*|encaminh\w*|previst\w*|parcial\w*|inoperant\w*|falhou|persist\w*|intermit\w*|temporari\w*|nao|sem confirmacao|a confirmar|sera|necessari\w*|se voltar|se funcionar|se normalizar)\b/;
const completion=/\b(voltou a (operar|funcionar)|retomou a operacao|funcionando normalmente|restabelecid[oa]s?|normalizad[oa]s?|atendimento concluid[oa]|servico concluid[oa])\b/;

// Conservative hint from the latest textual update, not a status transition.
export function completionHint(sources,profile){
  if(profile.status!=='unconfirmed'||profile.tasks.some(t=>!t.resolvedAt))return null;
  const latest=[...sources].filter(s=>s.text?.trim()).sort((a,b)=>b.timestamp-a.timestamp)[0];
  const text=normalize(latest?.text);
  if(!text||blockers.test(text)||!completion.test(text))return null;
  return {quote:latest.text.slice(0,450),sourceAt:latest.timestamp};
}
