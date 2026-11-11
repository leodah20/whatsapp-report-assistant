import test from 'node:test';
import assert from 'node:assert/strict';
import {followingContext,isUncaptionedMedia} from '../src/assistant/media-context.mjs';
const photo={id:'photo',type:'image',hasMedia:true,text:'',month:'2025-10',timestamp:100};
const next={id:'next',type:'chat',text:'Verificação do equipamento',month:photo.month,timestamp:101};
test('a photo looks ahead, preferring a direct reply over proximity',()=>{
  assert.equal(isUncaptionedMedia(photo),true);
  assert.deepEqual(followingContext(photo,[next],()=>true),{basis:'sequence',record:next});
  const reply={...next,id:'reply',timestamp:104,quotedId:photo.id};
  assert.deepEqual(followingContext(photo,[next,reply],()=>true),{basis:'reply',record:reply});
});
test('unrelated quotes, earlier messages, other months and distant text are not suggested',()=>{
  const records=[{...next,quotedId:'other'},{...next,timestamp:99},{...next,month:'2025-11'},{...next,timestamp:281}];
  assert.equal(followingContext(photo,records,()=>true),null);
  assert.equal(followingContext(photo,[next],()=>false),null);
});
