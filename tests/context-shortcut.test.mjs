import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const script=readFileSync(new URL('../web/cases.js',import.meta.url),'utf8');
const boundary=script.indexOf("for(const id of ['cancel','cancel-top'])");
assert(boundary>0);
const prefix=script.slice(0,boundary);
const suggestion='Trecho de exemplo verificado.';
function field(value='',maxLength=1000,offered=suggestion){
  const listeners=new Map(),events=[],children=[];
  const control={value,maxLength,parentElement:{replaceWith(){}},setAttribute(){},
    addEventListener:(name,listener)=>listeners.set(name,listener),
    dispatchEvent(event){events.push(event);listeners.get(event.type)?.(event);}};
  runInNewContext(prefix+'\nofferSuggestion(control,offered,"test-hint","Campo de teste");',{
    location:{hash:''},Event,control,offered,
    document:{createElement:()=>({setAttribute(){},append(...nodes){children.push(...nodes);}})},
  });
  const key=(params={})=>listeners.get('keydown')?.({key:'Tab',preventDefault(){assert.fail('O foco deve avançar normalmente');},...params});
  return {control,events,key,apply:children[1]};
}
test('Tab preenche a sugestão e emite input para marcar o formulário como editado',()=>{
  for(const initial of ['', 'Trecho de']){
    const {control,events,key}=field(initial);key();
    assert.equal(control.value,suggestion);
    assert.equal(events.length,1);assert.equal(events[0].type,'input');assert.equal(events[0].bubbles,true);
  }
});
test('Tab preserva edição divergente e não confirma com Shift ou composição',()=>{
  for(const [initial,params] of [['Texto diferente',{}],['',{shiftKey:true}],['',{isComposing:true}],['',{ctrlKey:true}],['',{key:'Enter'}]]){
    const {control,events,key}=field(initial);key(params);
    assert.equal(control.value,initial);assert.equal(events.length,0);
  }
});
test('sem sugestão utilizável não há mudança',()=>{
  for(const f of [field('',4),field('',1000,'')]){f.key();assert.equal(f.control.value,'');assert.equal(f.events.length,0);assert.equal(f.apply,undefined);}
});
test('toque aplica sugestão sem enviar o formulário e nunca substitui texto divergente',()=>{
  const good=field('Trecho de');
  assert.equal(good.apply.type,'button');
  good.apply.onclick();
  assert.equal(good.control.value,suggestion);
  assert.equal(good.events.length,1);
  assert.equal(good.apply.disabled,true);
  const different=field('Relato próprio');
  assert.equal(different.apply.disabled,true);
  different.apply.onclick();
  assert.equal(different.control.value,'Relato próprio');
  assert.equal(different.events.length,0);
});
