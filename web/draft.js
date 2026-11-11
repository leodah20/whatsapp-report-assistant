'use strict';
const $=id=>document.getElementById(id);
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const month=new URLSearchParams(location.search).get('month')||'';
const base='/api/cases/closing',query='?month='+encodeURIComponent(month);
const br=d=>d.split('-').reverse().join('/');
const statuses={done:'☑',pending:'Pendente',unknown:'A confirmar',na:'N/A'};
const paragraph=s=>s.replace(/\s+/g,' ').trim();
$('back').href='/fechamento'+query;
function page(data,cls=''){
  const p=el('section',undefined,'page '+cls),head=el('header',undefined,'band header'),foot=el('footer',undefined,'band footer'),body=el('div',undefined,'paper-body');
  head.append(el('span',data.name+' '+data.month.slice(5)+'/'+data.month.slice(2,4)),el('span','MINUTA · '+br(data.settings.issued)));
  foot.append(el('span',data.footer),el('span',String($('pages').childElementCount+1),'number'));
  p.append(head,body,foot);$('pages').append(p);return body;
}
function table(g,values){
  const t=el('table'),head=el('thead'),hr=el('tr'),body=el('tbody');
  t.append(el('caption','Manutenção Preventiva - '+g.name),head,body);
  ['Semana','Status','Tarefa',''].forEach(s=>{const c=el('th',s);c.scope='col';hr.append(c);});head.append(hr);
  g.rows.forEach(([week,task,category],i)=>{const tr=el('tr');for(const s of [week,statuses[values[i]],task,category])tr.append(el('td',s));body.append(tr);});
  return t;
}
async function picture(src,alt){const img=el('img');img.alt=alt;img.src=src;await img.decode();return img;}
async function run(){
  const response=await fetch(base+'/draft'+query,{signal:AbortSignal.timeout(15000)}),data=await response.json();
  if(!response.ok)throw Error(data.error||'Minuta indisponível.');
  const cover=el('section',undefined,'page cover');cover.append(await picture(base+'/cover'+query,'Capa institucional'));$('pages').append(cover);
  let offset=0;
  for(let i=0;i<data.groups.length;i+=3){
    const target=page(data,'preventive');
    for(const g of data.groups.slice(i,i+3)){target.append(table(g,data.settings.statuses.slice(offset,offset+g.rows.length)));offset+=g.rows.length;}
    if(target.scrollHeight>target.clientHeight+1)throw Error('A tabela não cabe na página. Revise o modelo local.');
  }
  let body;
  function place(unit){
    if(!body)body=page(data);
    body.append(unit);
    if(body.scrollHeight<=body.clientHeight+1)return;
    if(body.childElementCount===1)throw Error('Um item não cabe na página. Encurte o texto antes de imprimir.');
    unit.remove();body=page(data);body.append(unit);
    if(body.scrollHeight>body.clientHeight+1)throw Error('Um item não cabe na página. Encurte o texto antes de imprimir.');
  }
  for(const [i,item] of data.items.entries()){
    const block=el('article',undefined,'item'),when=item.historical?'':item.end&&item.end!==item.start?br(item.start)+' a '+br(item.end)+' ':br(item.start)+' ';
    block.append(el('h2',when+'Item '+String(i+1).padStart(2,'0')+' - '+item.title),el('p',paragraph(item.narrative)));
    for(const [n,photo] of item.photos.entries()){
      let img;
      try{img=await picture('/api/cases/'+item.code+'/media/'+photo,'Foto do item '+(i+1));}
      catch{throw Error('Uma foto selecionada do item '+(i+1)+' não está disponível. Volte à revisão.');}
      if(n===0)block.append(img);
      else{const next=el('div',undefined,'item');next.append(img);place(next);}
      if(n===0)place(block);
    }
    if(!item.photos.length)place(block);
  }
  if(data.settings.observations){const block=el('section',undefined,'item');block.append(el('h2','Observações'),el('p',paragraph(data.settings.observations)));place(block);}
  document.title='Minuta de atividades - '+data.month;
  $('notice').textContent=$('pages').childElementCount+' páginas · '+data.items.length+' itens revisados. Confira a minuta antes de salvar.';
  document.body.classList.add('ready');$('print').disabled=false;
  $('print').onclick=async()=>{
    $('print').disabled=true;
    try{
      const check=await fetch(base+'/draft'+query,{signal:AbortSignal.timeout(15000)}),next=await check.json();
      if(!check.ok||next.version!==data.version)throw Error('A revisão mudou. Volte ao fechamento e abra uma nova minuta.');
      window.print();
      $('print').disabled=false;
    }catch(e){document.body.classList.remove('ready');$('notice').textContent=e.message;}
  };
}
run().catch(e=>{$('notice').textContent=e.message||'Não foi possível montar a minuta.';});
