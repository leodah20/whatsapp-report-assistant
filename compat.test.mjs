import test from 'node:test';
import assert from 'node:assert/strict';
import {installIdCompatibility,groupChoices} from './compat.mjs';

test('identifier rename is supported without changing Object.prototype',async()=>{
  class Wid {constructor(value){this.$1=value;}}
  const id=new Wid('synthetic@g.us');
  const models={Chat:{getModelsArray:()=>[{id}]},Msg:{getModelsArray:()=>[]}};
  global.window={require:()=>models,WWebJS:{getMessageModel:m=>({id:{'$1':'synthetic-message'},body:m.body})}};
  try{
    const client={pupPage:{evaluate:fn=>fn()}};
    await installIdCompatibility(client);
    assert.equal(id._serialized,'synthetic@g.us');
    assert.equal(Object.prototype._serialized,undefined);
    assert.equal(window.WWebJS.getMessageModel({body:'dados',id}).id._serialized,'synthetic-message');
  }finally{delete global.window;}
});

test('group list does not serialize messages or private chat contents',async()=>{
  const group={id:{'$1':'synthetic@g.us'},formattedTitle:'Grupo sintético',get lastMessage(){throw Error('must not inspect');},serialize(){throw Error('must not serialize');}};
  const privateChat={id:{'$1':'synthetic@c.us'},get name(){throw Error('must not inspect');}};
  global.window={require:()=>({Chat:{getModelsArray:()=>[group,privateChat]}})};
  try{assert.deepEqual(await groupChoices({pupPage:{evaluate:fn=>fn()}}),[{id:'synthetic@g.us',name:'Grupo sintético'}]);}finally{delete global.window;}
});

test('legacy identifier still works',async()=>{
  global.window={require:()=>({Chat:{getModelsArray:()=>[{id:{_serialized:'legacy@g.us'},name:'Grupo sintético'}]}})};
  try{assert.equal((await groupChoices({pupPage:{evaluate:fn=>fn()}}))[0].id,'legacy@g.us');}finally{delete global.window;}
});
