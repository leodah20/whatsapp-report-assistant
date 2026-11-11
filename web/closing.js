'use strict';
const $=id=>document.getElementById(id);
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const url=(month,tail='')=>'/api/cases/closing'+tail+'?month='+encodeURIComponent(month);
const local=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'});
const clock=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'});
const stateLabels={unreviewed:'Por revisar',stale:'Fonte atualizada — rever',include:'Incluído',exclude:'Fora da minuta',defer:'Falta resposta'};
const fields={local:'Qual é o local exato?',equipamento:'Qual equipamento foi atendido?',ocorrencia:'O que aconteceu?',procedimento:'O que foi feito de fato?',resultado:'Qual foi o resultado observado ou o que ficou pendente?'};
const statuses={'':'Selecione…',done:'Concluída',pending:'Pendente',unknown:'Sem confirmação',na:'Não aplicável'};
let view=null,selected=null,serial=0,dirty=false,saving=false;
const notify=text=>{$('notice').textContent=text;$('notice').hidden=!text;};
async function request(path,options){const r=await fetch(path,{signal:AbortSignal.timeout(15000),...options});const value=await r.json();if(!r.ok)throw Error(value.error||'Fechamento indisponível.');return value;}
function control(parent,label,input){const l=el('label',label,'control');l.append(input);parent.append(l);return input;}
function input(type,value='',max=0){const i=el('input');i.type=type;i.value=value;if(max)i.maxLength=max;return i;}
function textarea(value,max){const i=el('textarea');i.value=value||'';i.maxLength=max;i.rows=4;return i;}
function select(values,value){const s=el('select');s.replaceChildren(...Object.entries(values).map(([k,v])=>new Option(v,k)));s.value=value||'';return s;}
function checkbox(parent,label,checked=false){const l=el('label',undefined,'check'),c=input('checkbox');c.checked=checked;l.append(c,el('span',label));parent.append(l);return c;}
function renderOverview(){
  $('counts').textContent=view.archiveCount+' mensagens no arquivo · '+view.items.length+' chamados · '+view.items.filter(x=>x.state==='include').length+' incluídos';
  $('checks').replaceChildren(...(view.checks.length?view.checks:['Revisão registrada. Você já pode abrir a minuta.']).map(x=>el('li',x)));
  $('draft').hidden=!!view.checks.length;
  $('draft').href='/minuta?month='+encodeURIComponent(view.month);
  $('history').href='/historico?month='+encodeURIComponent(view.month);
  $('list').replaceChildren(...view.items.map(x=>{
    const b=el('button',undefined,'case-card');b.type='button';b.setAttribute('aria-current',String(selected===x.code));
    b.append(el('span',x.code,'case-code'),el('h3',x.title),el('p',(x.carryover?'Anterior · ':'')+stateLabels[x.state]));
    b.onclick=()=>{if(!saving&&(!dirty||confirm('Descartar alterações não salvas?')))void openCase(x.code);};return b;
  }));
  if(!view.items.length)$('list').append(el('p','Nenhum chamado localizado neste recorte. Confira o arquivo antes de confirmar a cobertura.','hint'));
}
function renderSettings(){
  $('settings').hidden=!view.template;if(!view.template)return;
  $('issued').value=view.settings?.issued||'';$('issued').max=local.format(new Date());
  $('observations').value=view.settings?.observations||'';$('coverage').checked=view.settings?.coverage===view.coverage;
  let index=0;
  $('preventives').replaceChildren(...view.template.groups.map(g=>{
    const fieldset=el('fieldset');fieldset.append(el('legend',g.name));
    for(const [week,task,category] of g.rows){
      const s=select(statuses,view.settings?.statuses[index++]);s.required=true;s.name='preventive';
      const l=el('label',undefined,'preventive-row');l.append(el('span',task+' · '+category+(week?' · Semana '+week:'')),s);fieldset.append(l);
    }
    return fieldset;
  }));
}
async function load(month){
  if(saving||dirty&&!confirm('Descartar alterações não salvas?'))return;
  const n=++serial;
  try{
    const next=await request(url(month));if(n!==serial)return;
    view=next;selected=null;dirty=false;
    history.replaceState(null,'','/fechamento?month='+encodeURIComponent(month));
    $('editor').replaceChildren(el('h2','Selecione um chamado'));renderOverview();renderSettings();notify('');
  }catch(e){if(n===serial)notify(e.message);}
}
async function openCase(code){
  const n=++serial,month=view.month;
  try{
    const d=await request('/api/cases/'+code);if(n!==serial||view.month!==month)return;
    selected=code;dirty=false;renderOverview();
    const row=view.items.find(x=>x.code===code),r=row.review||{};
    const title=el('h2',d.title),form=el('form'),evidence=el('details');
    evidence.open=true;evidence.append(el('summary','Fontes e atualizações do chamado'));
    for(const s of d.sources)evidence.append(el('p',clock.format(new Date(s.timestamp*1000))+' — '+(s.text||'Fonte sem legenda.'),'evidence'));
    for(const e of d.profile.events)if(e.text)evidence.append(el('p',(e.occurredOn||'Atualização sem data de atendimento')+' — '+e.text,'evidence'));
    const context=el('p',row.state==='stale'?'Há informação nova. Reconfirme o texto e as imagens.':d.missing.length?d.missing.map(k=>fields[k]).filter(Boolean).join(' '):'Confira se o texto distingue execução, resultado observado e pendência.','notice');
    const decision=control(form,'Decisão',select({include:'Incluir na minuta',exclude:'Não incluir',defer:'Aguardar contexto'},r.decision||'defer'));
    const body=el('div'),reasonWrap=el('div');
    const reason=control(reasonWrap,'O que falta confirmar ou por que não incluir?',textarea(r.reason,1000));
    const heading=control(body,'Título técnico',input('text',r.title||d.title,180));
    const historical=checkbox(body,'Acompanhamento sem nova intervenção datada neste mês',r.historical);
    const dates=el('div',undefined,'date-row');
    const start=control(dates,'Data real do atendimento',input('date',r.start||''));
    const end=control(dates,'Fim do período, se aplicável',input('date',r.end||''));
    start.max=end.max=local.format(new Date());body.append(dates);
    const narrative=control(body,'Texto corrido para a minuta',textarea(r.narrative,3400));
    const pictures=el('fieldset'),gallery=el('div',undefined,'photo-list'),media=[];
    pictures.append(el('legend','Fotos correspondentes (opcional)'),gallery);
    d.sources.forEach((s,index)=>{
      if(s.mediaState!=='saved'||!/^image\/(jpeg|png|webp)(;|$)/.test(s.mime||''))return;
      const img=el('img');img.loading='lazy';img.alt='Evidência '+(index+1);img.src='/api/cases/'+code+'/media/'+index;
      const c=checkbox(gallery,'Foto '+(index+1),row.state!=='stale'&&r.photos?.includes(index));
      c.parentElement.prepend(img);media.push([index,c]);
    });
    if(!media.length)gallery.append(el('p','Nenhuma imagem arquivada para este chamado.','hint'));
    body.append(pictures);
    const verified=checkbox(body,'Conferi a data, o procedimento, o desfecho ou pendência e as fotos. O texto não assume causa nem normalização sem evidência.');
    form.append(body,reasonWrap);
    const save=el('button','Salvar decisão','button primary');form.append(save);
    function toggle(){const include=decision.value==='include';body.hidden=!include;reasonWrap.hidden=include;reason.required=!include;heading.required=narrative.required=verified.required=include;dates.hidden=historical.checked;start.required=include&&!historical.checked;}
    decision.onchange=historical.onchange=toggle;toggle();
    form.oninput=()=>{dirty=true;};
    form.onsubmit=async e=>{
      e.preventDefault();
      const payload=decision.value==='include'?{title:heading.value,start:historical.checked?'':start.value,end:historical.checked?'':end.value,historical:historical.checked,narrative:narrative.value,verified:verified.checked,photos:media.filter(([,c])=>c.checked).map(([index])=>index)}:{reason:reason.value};
      if(await saveData({kind:'review',code,stamp:row.stamp,decision:decision.value,...payload},save)){dirty=false;notify('Decisão salva. Nenhuma mensagem enviada.');}
    };
    $('editor').replaceChildren(title,context,evidence,form);
  }catch(e){if(n===serial)notify(e.message);}
}
async function saveData(payload,button){
  if(!view||saving)return false;
  saving=true;button.disabled=true;
  try{
    view=await request(url(view.month),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({version:view.version,...payload})});
    renderOverview();if(view.settings?.coverage!==view.coverage)$('coverage').checked=false;return true;
  }catch(e){notify(e.message);return false;}
  finally{saving=false;button.disabled=false;}
}
$('period').onsubmit=e=>{e.preventDefault();void load($('month').value);};
$('settings-form').onsubmit=async e=>{
  e.preventDefault();
  if(await saveData({kind:'settings',issued:$('issued').value,statuses:[...e.currentTarget.querySelectorAll('[name=preventive]')].map(x=>x.value),observations:$('observations').value,coverage:$('coverage').checked?view.coverage:null},e.submitter))notify('Preventivas e emissão salvas.');
};
const given=new URLSearchParams(location.search).get('month');
$('month').value=/^20\d\d-(0[1-9]|1[0-2])$/.test(given||'')?given:local.format(new Date()).slice(0,7);
void load($('month').value);
