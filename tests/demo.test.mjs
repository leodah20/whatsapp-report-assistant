import test from 'node:test';
import assert from 'node:assert/strict';
import {createDemoServer} from '../scripts/serve-demo.mjs';

test('demo serves synthetic cases and refuses writes and production routes',async t=>{
  const server=createDemoServer();
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const origin='http://127.0.0.1:'+server.address().port;
  const get=path=>fetch(origin+path);
  const html=await get('/');
  assert.equal(html.status,200);
  assert.match(await html.text(),/data-demo="true"/);
  assert.equal((await get('/api-explorer')).status,200);
  const date=new Intl.DateTimeFormat('sv-SE',{year:'numeric',month:'2-digit',timeZone:'America/Sao_Paulo'}).format(new Date());
  const {items}=await (await get('/api/cases?month='+date)).json();
  assert.equal(items.length,5);
  const detail='/api/cases/'+items[0].code;
  assert.ok((await (await get(detail)).json()).sources[0].text);
  assert.equal((await fetch(origin+detail,{method:'POST'})).status,405);
  for(const path of ['/api/status','/api/cases/closing','/api/cases/history','/.env.local','/data/','/api/cases/R-12345678']){
    assert.equal((await get(path)).status,404,path);
  }
});
