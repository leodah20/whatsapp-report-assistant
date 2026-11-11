import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const script=readFileSync(new URL('../web/cases.js',import.meta.url),'utf8');
const boundary=script.indexOf("$('edit-status').onchange=configureForm;");
assert(boundary>0);
const prefix=script.slice(0,boundary);
const suggestion='Trecho de exemplo verificado.';
function field(value='',maxLength=1000,offered=suggestion){
  const listeners=new Map(),events=[];
  const control={value,maxLength,parentElement:{append(){}},setAttribute(){},
    addEventListener:(name,listener)=>listeners.set(name,listener),
    dispatchEvent(event){events.push(event);listeners.get(event.type)?.(event);}};
  runInNewContext(prefix+'\nofferTabSuggestion(control,offered,"test-hint");',{
    location:{hash:''},Event,control,offered,
    document:{createElement:()=>({})},
  });
  const key=(params={})=>listeners.get('keydown')?.({key:'Tab',preventDefault(){assert.fail('O foco deve avançar normalmente');},...params});
  return {control,events,key};
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
  for(const f of [field('',4),field('',1000,'')]){f.key();assert.equal(f.control.value,'');assert.equal(f.events.length,0);}
});
