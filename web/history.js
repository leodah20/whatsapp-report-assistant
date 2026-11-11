'use strict';
const $=id=>document.getElementById(id),el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const fmt=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'});
let month='',offset=0,job=null,loading=false;
const notify=s=>{$('notice').textContent=s;$('notice').hidden=!s;};
async function api(payload){
  const response=await fetch('/api/cases/history?month='+encodeURIComponent(month)+'&offset='+offset,payload?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}:{});
  const result=await response.json();if(!response.ok)throw Error(result.error);return result;
}
async function load({replace=true}={}){
  if(loading)return;loading=true;
  try{
    const data=await api();job=data.job;
    $('count').textContent=data.count+' fontes sem chamado'+(job?' · '+(job.state==='running'?'Varredura em andamento':'Varredura encerrada')+': '+job.scanned+'/'+job.total+(job.kind==='context'?' chamados; '+job.created+' revisados; ':' fontes; '+job.created+' rascunhos; ')+((job.needsReview||0)+job.failed)+' mantidos para conferência.':'');
    $('prepare').disabled=job?.state==='running'||!data.count;
    $('recheck').disabled=job?.state==='running';
    $('previous').disabled=!offset;$('next').disabled=offset+50>=data.count;
    if(replace)$('sources').replaceChildren(...data.sources.map(s=>{
      const l=el('label',undefined,'record control'),c=el('input');c.type='checkbox';c.value=s.id;c.name='source';
      l.append(c,el('span',fmt.format(new Date(s.timestamp*1000))+(s.hasMedia?' · Anexo':'')),el('span',s.text||'Fonte sem legenda.','evidence'));
      if(Object.hasOwn(s,'contextSuggestion')){
        const h=s.contextSuggestion;
        l.append(el('span',h?(h.basis==='reply'?'Resposta à mídia':'Mensagem seguinte — confirmar vínculo')+(h.code?' · '+h.code:'')+' · '+h.text:'Qual é o chamado desta mídia? Não há texto seguinte próximo para sugerir um vínculo.','hint evidence'));
      }
      if(s.followupSuggestion)l.append(el('span','Possível atualização. '+(s.followupSuggestion.length?'Confira '+s.followupSuggestion.join(', ')+'.':'Qual chamado já registrado recebeu esta atualização?'),'hint evidence'));
      return l;
    }));
  }catch(e){notify(e.message);}finally{loading=false;}
}
$('period').onsubmit=e=>{e.preventDefault();if(loading)return;month=$('month').value;offset=0;void load();};
$('previous').onclick=()=>{if(!loading){offset=Math.max(0,offset-50);void load();}};
$('next').onclick=()=>{if(!loading){offset+=50;void load();}};
$('prepare').onclick=async()=>{
  $('prepare').disabled=true;
  try{job=await api({kind:'prepare'});await load({replace:false});}
  catch(e){notify(e.message);$('prepare').disabled=false;}
};
$('recheck').onclick=async()=>{
  $('recheck').disabled=true;
  try{job=await api({kind:'recheck'});await load({replace:false});}
  catch(e){notify(e.message);$('recheck').disabled=false;}
};
$('assign').onsubmit=async e=>{
  e.preventDefault();const ids=[...$('sources').querySelectorAll('input:checked')].map(x=>x.value);e.submitter.disabled=true;
  try{
    const result=await api({kind:'assign',ids,code:$('code').value.trim().toUpperCase()});
    $('notice').replaceChildren(el('span','Fontes vinculadas. '));const a=el('a','Abrir '+result.code);a.href='/chamados#'+result.code;$('notice').append(a);$('notice').hidden=false;offset=0;await load();
  }catch(e){notify(e.message);}finally{e.submitter.disabled=false;}
};
const requested=new URLSearchParams(location.search).get('month');
const code=new URLSearchParams(location.search).get('code');
if(/^R-[A-F0-9]{8}$/.test(code||''))$('code').value=code;
month=$('month').value=/^20\d\d-(0[1-9]|1[0-2])$/.test(requested||'')?requested:new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(new Date()).slice(0,7);
void load();setInterval(()=>{if(job?.state==='running')void load({replace:!$('sources').querySelector('input:checked')});},4000);
