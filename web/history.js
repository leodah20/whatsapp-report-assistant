'use strict';
const $=id=>document.getElementById(id),el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const fmt=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'});
let month='',offset=0,job=null,loading=false,assigning=false,targets=[],targetLoad=0,ready=false;
const initialTarget=new URLSearchParams(location.search).get('code');
let selectedTarget=/^R-[A-F0-9]{8}$/.test(initialTarget||'')?initialTarget:'';
const normalize=s=>String(s||'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
const notify=s=>{$('notice').textContent=s;$('notice').hidden=!s;};
const showingIgnored=()=>$('ignored').checked;
const picked=()=>[...$('sources').querySelectorAll('input[name=source]:checked')].map(x=>x.value);
function selection(){
  const count=picked().length,disabled=assigning||loading||!ready||!count||count>24,ignored=showingIgnored();
  $('selected-count').textContent=count+(count===1?' selecionada':' selecionadas');
  $('assign-save').disabled=disabled||ignored||!$('target').value;
  $('create-case').disabled=disabled||ignored;
  $('ignore-sources').disabled=disabled;
  $('assign-save').hidden=$('create-case').hidden=$('target-controls').hidden=ignored;
  $('ignore-sources').textContent=ignored?'Restaurar seleção':count===1?'Ignorar mensagem':'Ignorar seleção';
  $('source-title').textContent=ignored?'Mensagens ignoradas':'Fontes disponíveis';
  $('selection-help').textContent=count>24?'Selecione no máximo 24 registros.':ignored?'Restaurar devolve o registro à fila, sem criar chamado.':'Selecione os registros abaixo e escolha o que fazer com eles.';
}
function monthLinks(){for(const a of document.querySelectorAll('[data-month-nav]'))a.href=a.pathname+'?month='+encodeURIComponent(month);}
const endpoint=()=>'/api/cases/history?'+new URLSearchParams({month,offset,ignored:showingIgnored()?'1':'0'});
async function api(payload,extra=''){
  const response=await fetch(endpoint()+extra,payload?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}:{});
  const result=await response.json();if(!response.ok)throw Error(result.error);return result;
}
function showTargets(){
  const query=normalize($('target-search').value.trim()),select=$('target');
  const rows=targets.filter(t=>normalize([t.title,t.location,t.area,t.month,t.status,t.code].join(' ')).includes(query));
  select.replaceChildren(new Option(rows.length?'Selecione um chamado':'Nenhum chamado encontrado',''));
  for(const [current,label] of [[true,'Nesta competência'],[false,'Outras competências']]){
    const group=el('optgroup');group.label=label;
    for(const t of rows.filter(t=>t.current===current)){
      const date=t.day?t.day.split('-').reverse().join('/'):t.referenceAt?fmt.format(new Date(t.referenceAt*1000)):t.month;
      group.append(new Option([t.title,t.location,t.area,date,t.status,t.code].filter(Boolean).join(' · '),t.code));
    }
    if(group.children.length)select.append(group);
  }
  select.disabled=!rows.length;select.value=rows.some(t=>t.code===selectedTarget)?selectedTarget:'';selection();
}
async function loadTargets(){
  const attempt=++targetLoad;
  try{const data=await api(null,'&targets=1');if(attempt!==targetLoad)return;targets=data.targets;showTargets();}
  catch(e){if(attempt===targetLoad){targets=[];showTargets();notify(e.message);}}
}
function mediaTools(s){
  if(!s.hasMedia)return null;
  const mediaKind=s.mediaKind;
  if(s.mediaState!=='saved'||!mediaKind)return el('p',s.mediaState==='too-large'?'Anexo acima do limite de arquivamento.':'Anexo não disponível no arquivo local.','hint source-preview');
  const url='/api/cases/history/media?'+new URLSearchParams({month,id:s.id,ignored:showingIgnored()?'1':'0'});
  const download=el('a','Baixar anexo');download.href=url+'&download=1';download.download='';
  const labels={image:'Ver imagem',video:'Ver vídeo',audio:'Ouvir áudio'};
  if(!Object.hasOwn(labels,mediaKind)){download.className='source-preview';return download;}
  const details=el('details',undefined,'source-preview'),summary=el('summary',labels[mediaKind]),preview=el('div',undefined,'source-preview-body');
  details.setAttribute('name','historical-preview');details.append(summary,preview,download);
  details.ontoggle=()=>{
    if(!details.open){const player=preview.querySelector('video,audio');if(player){player.pause();player.removeAttribute('src');player.load();}preview.replaceChildren();return;}
    if(preview.childNodes.length)return;
    const node=el(mediaKind==='image'?'img':mediaKind);
    if(mediaKind==='image')node.alt='Imagem da mensagem arquivada';
    else{node.controls=true;node.preload='metadata';if(mediaKind==='video')node.playsInline=true;}
    node.onerror=()=>{if(node.isConnected)node.replaceWith(el('p','Não foi possível abrir a prévia. Se o arquivo estiver disponível, use Baixar anexo.','hint'));};
    node.src=url;preview.append(node);
  };
  return details;
}
async function load({replace=true}={}){
  if(loading)return;loading=true;selection();
  try{
    const data=await api();job=data.job;
    $('count').textContent=data.count+(showingIgnored()?' mensagens ignoradas':' fontes sem chamado')+(job?' · '+(job.state==='running'?'Varredura em andamento':'Varredura encerrada')+': '+job.scanned+'/'+job.total+(job.kind==='context'?' chamados; '+job.created+' revisados; ':' fontes; '+job.created+' rascunhos; ')+((job.needsReview||0)+job.failed)+' mantidos para conferência.':'');
    $('prepare').disabled=showingIgnored()||job?.state==='running'||!data.count;
    $('recheck').disabled=job?.state==='running';
    $('previous').disabled=!offset;$('next').disabled=offset+50>=data.count;
    if(replace)$('sources').replaceChildren(...data.sources.map((s,index)=>{
      const l=el('div',undefined,'source-record'),c=el('input'),content=el('label',undefined,'source-content');c.type='checkbox';c.value=s.id;c.name='source';c.id='source-'+index;content.htmlFor=c.id;
      const text=s.text?.trim()?s.text:'';
      l.append(c,content);content.append(el('span',fmt.format(new Date(s.timestamp*1000))+(s.hasMedia?(text?' · Legenda original':' · Anexo'):' · Mensagem original'),'hint'),el('span',text||(s.hasMedia?'Sem legenda.':'Mensagem sem texto.'),'evidence'));
      if(Object.hasOwn(s,'contextSuggestion')){
        const h=s.contextSuggestion;
        content.append(el('span',h?(h.basis==='reply'?'Resposta à mídia':'Mensagem seguinte — confirmar vínculo')+(h.code?' · '+h.code:'')+' · '+h.text:'Qual é o chamado desta mídia? Não há texto seguinte próximo para sugerir um vínculo.','hint evidence'));
      }
      if(s.followupSuggestion)content.append(el('span','Possível atualização. '+(s.followupSuggestion.length?'Confira '+s.followupSuggestion.join(', ')+'.':'Qual chamado já registrado recebeu esta atualização?'),'hint evidence'));
      const tools=mediaTools(s);if(tools)l.append(tools);
      return l;
    }));
    if(replace&&!data.sources.length)$('sources').append(el('p',showingIgnored()?'Nenhuma mensagem ignorada nesta página.':'Nenhuma fonte sem chamado nesta página.','hint history-empty'));
    if(replace)ready=true;
  }catch(e){notify(e.message);}finally{loading=false;selection();}
}
$('period').onsubmit=e=>{e.preventDefault();if(loading||assigning)return;month=$('month').value;offset=0;ready=false;targets=[];showTargets();monthLinks();void load();void loadTargets();};
$('previous').onclick=()=>{if(!loading&&!assigning){offset=Math.max(0,offset-50);void load();}};
$('next').onclick=()=>{if(!loading&&!assigning){offset+=50;void load();}};
$('sources').onchange=selection;
$('target-search').oninput=showTargets;
$('target').onchange=()=>{selectedTarget=$('target').value;selection();};
$('ignored').onchange=()=>{
  if(loading||assigning){$('ignored').checked=!$('ignored').checked;return;}
  offset=0;ready=false;$('sources').replaceChildren();notify('');void load();
};
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
async function apply(action){
  const ids=picked(),ignored=showingIgnored(),code=action==='link'?$('target').value:'';
  if(assigning||loading||!ready||!ids.length||ids.length>24||action==='link'&&!code||ignored&&action!=='ignore')return;
  assigning=true;selection();
  try{
    if(action==='ignore'){
      await api({kind:ignored?'restore':'ignore',ids});
      notify(ignored?'Seleção restaurada na fila de fontes.':'Seleção ignorada. Você pode restaurá-la em Ver mensagens ignoradas.');
    }else{
      const result=await api({kind:'assign',ids,code});
      $('notice').replaceChildren(el('span',code?'Fontes vinculadas. ':'Novo chamado criado para revisão. '));
      const a=el('a','Abrir '+result.code);a.href='/chamados?month='+encodeURIComponent(month)+'#'+result.code;$('notice').append(a);$('notice').hidden=false;
      void loadTargets();
    }
    offset=0;ready=false;$('sources').replaceChildren();await load();
  }catch(e){notify(e.message);}finally{assigning=false;selection();}
}
$('assign').onsubmit=e=>e.preventDefault();
$('assign-save').onclick=()=>void apply('link');
$('create-case').onclick=()=>void apply('create');
$('ignore-sources').onclick=()=>void apply('ignore');
const requested=new URLSearchParams(location.search).get('month');
month=$('month').value=/^20\d\d-(0[1-9]|1[0-2])$/.test(requested||'')?requested:new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(new Date()).slice(0,7);
monthLinks();void load();void loadTargets();setInterval(()=>{if(!assigning&&job?.state==='running')void load({replace:!$('sources').querySelector('input:checked,details[open]')});},4000);
