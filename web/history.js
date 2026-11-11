'use strict';
const $=id=>document.getElementById(id),el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const fmt=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'});
let month='',offset=0,job=null,loading=false,assigning=false;
const notify=s=>{$('notice').textContent=s;$('notice').hidden=!s;};
function selection(){
  const count=$('sources').querySelectorAll('input:checked').length;
  $('selected-count').textContent=count+(count===1?' selecionada':' selecionadas');
  $('assign-save').disabled=assigning||loading||!count;
}
function monthLinks(){for(const a of document.querySelectorAll('[data-month-nav]'))a.href=a.pathname+'?month='+encodeURIComponent(month);}
async function api(payload){
  const response=await fetch('/api/cases/history?month='+encodeURIComponent(month)+'&offset='+offset,payload?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}:{});
  const result=await response.json();if(!response.ok)throw Error(result.error);return result;
}
async function load({replace=true}={}){
  if(loading)return;loading=true;selection();
  try{
    const data=await api();job=data.job;
    $('count').textContent=data.count+' fontes sem chamado'+(job?' · '+(job.state==='running'?'Varredura em andamento':'Varredura encerrada')+': '+job.scanned+'/'+job.total+(job.kind==='context'?' chamados; '+job.created+' revisados; ':' fontes; '+job.created+' rascunhos; ')+((job.needsReview||0)+job.failed)+' mantidos para conferência.':'');
    $('prepare').disabled=job?.state==='running'||!data.count;
    $('recheck').disabled=job?.state==='running';
    $('previous').disabled=!offset;$('next').disabled=offset+50>=data.count;
    if(replace)$('sources').replaceChildren(...data.sources.map(s=>{
      const l=el('label',undefined,'source-record'),c=el('input'),content=el('span',undefined,'source-content');c.type='checkbox';c.value=s.id;c.name='source';
      l.append(c,content);content.append(el('span',fmt.format(new Date(s.timestamp*1000))+(s.hasMedia?' · Anexo':''),'hint'),el('span',s.text||'Fonte sem legenda.','evidence'));
      if(Object.hasOwn(s,'contextSuggestion')){
        const h=s.contextSuggestion;
        content.append(el('span',h?(h.basis==='reply'?'Resposta à mídia':'Mensagem seguinte — confirmar vínculo')+(h.code?' · '+h.code:'')+' · '+h.text:'Qual é o chamado desta mídia? Não há texto seguinte próximo para sugerir um vínculo.','hint evidence'));
      }
      if(s.followupSuggestion)content.append(el('span','Possível atualização. '+(s.followupSuggestion.length?'Confira '+s.followupSuggestion.join(', ')+'.':'Qual chamado já registrado recebeu esta atualização?'),'hint evidence'));
      return l;
    }));
    if(replace&&!data.sources.length)$('sources').append(el('p','Nenhuma fonte sem chamado nesta página.','hint history-empty'));
  }catch(e){notify(e.message);}finally{loading=false;selection();}
}
$('period').onsubmit=e=>{e.preventDefault();if(loading||assigning)return;month=$('month').value;offset=0;monthLinks();void load();};
$('previous').onclick=()=>{if(!loading&&!assigning){offset=Math.max(0,offset-50);void load();}};
$('next').onclick=()=>{if(!loading&&!assigning){offset+=50;void load();}};
$('sources').onchange=selection;
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
  e.preventDefault();const ids=[...$('sources').querySelectorAll('input:checked')].map(x=>x.value);if(assigning||loading||!ids.length)return;assigning=true;selection();
  try{
    const result=await api({kind:'assign',ids,code:$('code').value.trim().toUpperCase()});
    $('notice').replaceChildren(el('span','Fontes vinculadas. '));const a=el('a','Abrir '+result.code);a.href='/chamados?month='+encodeURIComponent(month)+'#'+result.code;$('notice').append(a);$('notice').hidden=false;offset=0;await load();
  }catch(e){notify(e.message);}finally{assigning=false;selection();}
};
const requested=new URLSearchParams(location.search).get('month');
const code=new URLSearchParams(location.search).get('code');
if(/^R-[A-F0-9]{8}$/.test(code||''))$('code').value=code;
month=$('month').value=/^20\d\d-(0[1-9]|1[0-2])$/.test(requested||'')?requested:new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(new Date()).slice(0,7);
monthLinks();void load();setInterval(()=>{if(!assigning&&job?.state==='running')void load({replace:!$('sources').querySelector('input:checked')});},4000);
