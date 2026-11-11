const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const ids=s=>[...normalize(s).matchAll(/\b(nvr|dvr|ramal)\s*[-#:]?\s*(\d{2,6})\b/g)].map(m=>m[1]+':'+m[2]);
const words=s=>new Set(normalize(s).match(/\b(switch|gbic|fibra|corporativo|residencial|subsolo|interfonia|controladora|detector|eletroima|acesso)\b/g)||[]);
export function followupMatch(text,cases){
  const clean=normalize(text);
  const explicit=/\b(atualizacao|complemento|continuacao|mesmo chamado|sobre o chamado|referente ao chamado)\b/.test(clean);
  const outcome=/\b(apos|voltou|normaliz\w*|restabelec\w*|segue|permanece)\b/.test(clean);
  if(/\b(novo chamado|nova ocorrencia|outro chamado)\b/.test(clean)||!explicit&&!outcome)return {target:null,candidates:[],review:false};
  const incoming=ids(clean),terms=words(clean);
  const exact=cases.filter(c=>incoming.length===1&&ids(c.text).includes(incoming[0]));
  const similar=cases.filter(c=>{const known=words(c.text);return [...terms].filter(w=>known.has(w)).length>=3;});
  const candidates=[...new Set([...exact,...similar].map(c=>c.code))];
  return {target:explicit&&exact.length===1&&candidates.length===1?exact[0].id:null,candidates,review:explicit||candidates.length>0};
}
