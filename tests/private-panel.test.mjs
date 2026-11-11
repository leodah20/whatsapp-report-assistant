import test from 'node:test';
import assert from 'node:assert/strict';
import {request} from 'node:http';
import {createPrivatePanel} from '../scripts/serve-private-panel.mjs';

test('private panel allows only owner over HTTPS and scoped, same-origin edits',async t=>{
  const host='example.demo.ts.net',login='owner@example.invalid',origin='https://'+host;
  const token='a'.repeat(64),seen=[];
  const server=createPrivatePanel({host,login,fetcher:async(url,options)=>{
    seen.push({url,options});
    if(url.endsWith('/chamados'))return new Response('<body class="cases-page"><a href="/">Configuração</a></body>',{headers:{'content-type':'text/html','set-cookie':'case_session='+token+'; Path=/'}});
    return Response.json({ok:true});
  }});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const call=(path,{headers={},method='GET',body}={})=>new Promise((resolve,reject)=>{
    const req=request({host:'127.0.0.1',port:server.address().port,path,method,headers:{
      Host:host,'X-Forwarded-Proto':'https','Tailscale-User-Login':login,...headers
    }},res=>{
      const parts=[];res.on('data',x=>parts.push(x));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(parts).toString()}));
    });
    req.on('error',reject);req.end(body);
  });
  assert.equal((await call('/chamados',{headers:{'Tailscale-User-Login':'viewer@example.invalid'}})).status,403);
  assert.equal((await call('/chamados',{headers:{'Tailscale-User-Login':''}})).status,403);
  assert.equal((await call('/chamados',{headers:{'X-Forwarded-Proto':'http'}})).status,403);
  assert.equal((await call('/chamados',{headers:{Host:'other.demo.ts.net'}})).status,403);
  for(const path of ['/api/status','/api/history','/api/cases/history','/api/cases/closing','/api/cases/../status','//other.demo.ts.net/','/api/cases/R-ABCD1234/photo'])assert.ok((await call(path)).status>=400,path);
  assert.equal(seen.length,0);
  const page=await call('/chamados');
  assert.equal(page.status,200);
  assert.match(page.body,/data-remote="true"/);
  assert.doesNotMatch(page.body,/Configuração/);
  assert.match(page.headers['set-cookie'][0],/^__Host-remote_case=.*; Secure; HttpOnly; SameSite=Strict; Path=\//);
  const headers={Origin:origin,'Content-Type':'application/json',Cookie:'__Host-remote_case='+token+'; session=ignore'};
  const path='/api/cases/R-ABCD1234';
  const write=body=>({method:'POST',headers,body:JSON.stringify(body)});
  assert.equal((await call(path,{...write({kind:'note'}),headers:{...headers,Origin:'https://other.invalid'}})).status,403);
  assert.equal((await call(path,{...write({kind:'note'}),headers:{...headers,Cookie:''}})).status,403);
  assert.equal((await call(path,write({kind:'archive'}))).status,403);
  assert.equal(seen.length,1);
  const edit={kind:'note',version:1,text:'Atualização fictícia',occurredOn:'2026-01-01'};
  assert.equal((await call(path,write(edit))).status,200);
  assert.equal(seen.at(-1).options.headers.origin,'http://127.0.0.1:8767');
  assert.equal(seen.at(-1).options.headers.cookie,'case_session='+token);
  assert.deepEqual(JSON.parse(seen.at(-1).options.body),edit);
});
