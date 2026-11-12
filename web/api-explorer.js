'use strict';
const byId=id=>document.getElementById(id);
const routes={
  runtime:{description:'Conexão, supervisão e fila de análise.',path:()=>'/api/cases/runtime'},
  month:{description:'Chamados registrados na competência selecionada.',path:()=>'/api/cases?'+new URLSearchParams({month:byId('api-month').value})},
  case:{description:'Contexto, histórico e referências às evidências do chamado.',path:()=>'/api/cases/'+encodeURIComponent(byId('api-code').value.toUpperCase())}
};
const select=byId('api-route'),result=byId('api-result'),status=byId('api-status');
byId('api-month').value=new Intl.DateTimeFormat('sv-SE',{year:'numeric',month:'2-digit',timeZone:'America/Sao_Paulo'}).format(new Date());
function update(){
  const route=routes[select.value];
  for(const [field,visible] of [['month',select.value==='month'],['code',select.value==='case']]){
    byId('api-'+field+'-field').hidden=!visible;
    byId('api-'+field).disabled=!visible;
    byId('api-'+field).required=visible;
  }
  byId('api-description').textContent=route.description;
  byId('api-path').textContent='GET '+route.path();
  result.hidden=true;result.textContent='';status.textContent='Aguardando consulta.';
}
select.onchange=update;
for(const field of ['month','code'])byId('api-'+field).oninput=update;
byId('api-query').onsubmit=async e=>{
  e.preventDefault();
  const run=byId('api-run');
  if(run.disabled)return;
  const route=routes[select.value],path=route.path();
  run.disabled=true;result.hidden=true;result.textContent='';status.textContent='Consultando…';
  try{
    const response=await fetch(path,{method:'GET',credentials:'same-origin',mode:'same-origin',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(12000)});
    const payload=await response.json();
    if(routes[select.value]!==route||route.path()!==path)return;
    status.textContent='HTTP '+response.status+(response.status===401?' · Recarregue a página para renovar a sessão.':'');
    const json=JSON.stringify(payload,null,2);
    result.textContent=json.length>240000?json.slice(0,240000)+'\n… Prévia limitada.':json;
    result.hidden=false;
  }catch{
    if(routes[select.value]===route&&route.path()===path)status.textContent='Não foi possível ler a resposta do coletor.';
  }finally{run.disabled=false;}
};
update();
