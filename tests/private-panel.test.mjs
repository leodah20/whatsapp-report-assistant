import test from 'node:test';
import assert from 'node:assert/strict';
import {request} from 'node:http';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createPrivatePanel} from '../scripts/serve-private-panel.mjs';
import {createAccessStore} from '../scripts/private-panel-access.mjs';

test('private panel allows only owner over HTTPS and scoped, same-origin edits',async t=>{
  const host='example.demo.ts.net:8443',login='owner@example.invalid',origin='https://'+host;
  const token='a'.repeat(64),seen=[];
  const server=createPrivatePanel({host,login,fetcher:async(url,options)=>{
    seen.push({url,options});
    if(['/chamados','/historico','/fechamento','/minuta','/api-explorer'].includes(new URL(url).pathname))return new Response('<body class="cases-page"><a href="/">Configuração</a></body>',{headers:{'content-type':'text/html','set-cookie':'case_session='+token+'; Path=/'}});
    if(url.includes('/closing/package'))return new Response(Uint8Array.of(80,75,3,4),{headers:{'content-type':'application/zip','content-disposition':'attachment; filename="exemplo.zip"'}});
    if(url.includes('/history/media'))return new Response(Uint8Array.of(1,2,3),{status:206,headers:{'content-type':'video/mp4','content-range':'bytes 0-2/10','accept-ranges':'bytes'}});
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
  for(const path of ['/api/status','/api/assistant','/api/month','/api/history','/api/cases/../status','//other.demo.ts.net/','/api/cases/R-ABCD1234/photo'])assert.ok((await call(path)).status>=400,path);
  assert.equal(seen.length,0);
  const page=await call('/chamados');
  assert.equal(page.status,200);
  assert.match(page.body,/href="\/configuracao">Configuração/);
  assert.match(page.headers['set-cookie'][0],/^__Host-remote_case=.*; Secure; HttpOnly; SameSite=Strict; Path=\//);
  const headers={Origin:origin,'Content-Type':'application/json',Cookie:'__Host-remote_case='+token+'; session=ignore'};
  const path='/api/cases/R-ABCD1234';
  const write=body=>({method:'POST',headers,body:JSON.stringify(body)});
  assert.equal((await call(path,{...write({kind:'note'}),headers:{...headers,Origin:'https://other.invalid'}})).status,403);
  assert.equal((await call(path,{...write({kind:'note'}),headers:{...headers,Cookie:''}})).status,403);
  assert.equal((await call(path,write({kind:'send'}))).status,403);
  assert.equal(seen.length,1);
  assert.equal((await call('/brand/fonts/Manrope.ttf')).status,200);
  assert.equal((await call('/brand/fonts/OFL.txt')).status,404);
  const edit={kind:'note',version:1,text:'Atualização fictícia',occurredOn:'2026-01-01'};
  assert.equal((await call(path,write(edit))).status,200);
  assert.equal(seen.at(-1).options.headers.origin,'http://127.0.0.1:8767');
  assert.equal(seen.at(-1).options.headers.cookie,'case_session='+token);
  assert.deepEqual(JSON.parse(seen.at(-1).options.body),edit);
  for(const pagePath of ['/historico','/fechamento','/minuta','/api-explorer','/configuracao']){
    const response=await call(pagePath);
    assert.equal(response.status,200,pagePath);
    assert.ok(response.headers['set-cookie'],pagePath);
  }
  const month='?month=2026-01';
  assert.equal((await call('/api/cases/history'+month,write({kind:'assign',ids:['ficticio']}))).status,200);
  assert.equal((await call('/api/cases/closing'+month,write({kind:'sources'}))).status,200);
  assert.equal((await call('/api/cases/closing'+month,write({kind:'assign'}))).status,403);
  const zip=await call('/api/cases/closing/package'+month,write({codes:['R-ABCD1234'],fingerprint:'ficticio'}));
  assert.equal(zip.status,200);
  assert.equal(zip.headers['content-type'],'application/zip');
  assert.match(zip.headers['content-disposition'],/exemplo\.zip/);
  assert.equal(zip.body.slice(0,2),'PK');
  const media=await call('/api/cases/history/media'+month,{headers:{Range:'bytes=0-2'}});
  assert.equal(media.status,206);
  assert.equal(media.headers['content-range'],'bytes 0-2/10');
  assert.equal(seen.at(-1).options.headers.range,'bytes=0-2');
  for(const denied of ['/api/connect','/api/select','/api/pause','/api/questions','/api/context','/api/history'])assert.equal((await call(denied,write({kind:'prepare'}))).status,404);
  assert.equal((await call(path+'/photo',{...write({}),headers:{...headers,'Content-Type':'image/svg+xml'}})).status,403);
  assert.equal((await call(path+'/photo',{method:'POST',headers:{...headers,'Content-Type':'image/png'},body:Buffer.from([1,2,3])})).status,200);
});

test('roles are enforced before forwarding, redact collector data, and apply revocation immediately',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'rv-access-'));
  const file=join(dir,'access.json'),access=createAccessStore(file),calls=[];
  const host='example.demo.ts.net:8443',login='owner@example.invalid',partner='partner@example.invalid';
  const origin='https://'+host,token='a'.repeat(64),casePath='/api/cases/R-ABCD1234';
  const server=createPrivatePanel({host,login,access,fetcher:async(url,options)=>{
    const path=new URL(url).pathname;calls.push({path,method:options.method});
    if(path==='/chamados')return new Response('<head></head><body class="cases-page"></body>',{headers:{'set-cookie':'case_session='+token+'; Path=/'}});
    const item={code:'R-ABCD1234',title:'Teste',profile:{tasks:[{id:'t',text:'Aguardar peça',internal:'omit-task'}],events:[]},
      facts:[{field:'ocorrencia',quote:'Falha',sourceId:'omit-fact'}],sources:[{text:'omit-source'}],notices:[{text:'omit-notice'}],externalTicket:{lastState:'novo',secret:'omit-ticket'}};
    if(path==='/api/cases')return Response.json({items:[item],unlinkedCount:8});
    return Response.json(item);
  }});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true});});
  const hit=(path,user=partner,body,overrides={})=>new Promise((resolve,reject)=>{
    const req=request({host:'127.0.0.1',port:server.address().port,path,method:body===undefined?'GET':'POST',
      headers:{Host:host,'X-Forwarded-Proto':'https','Tailscale-User-Login':user,
        Origin:origin,'Content-Type':'application/json',Cookie:'__Host-remote_case='+token,...overrides}},res=>{
      const chunks=[];res.on('data',x=>chunks.push(x));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));
    });req.on('error',reject);req.end(body===undefined?undefined:JSON.stringify(body));
  });
  const manage='/api/panel/access';
  assert.equal((await hit('/chamados')).status,403);
  assert.equal((await hit(manage,partner,{login:partner,role:'editor'})).status,403);
  assert.equal((await hit(manage,login,{login:partner,role:'admin'})).status,400);
  assert.equal((await hit(manage,login,{login,role:null})).status,400);
  assert.equal((await hit(manage,login,{login:partner,role:'viewer'},{Origin:'https://another.invalid'})).status,403);
  assert.equal((await hit(manage,login,{login:partner,role:'viewer'})).status,200);
  assert.equal(createAccessStore(file).list().get(partner),'viewer');
  assert.deepEqual(JSON.parse((await hit(manage,login)).body),[{login:partner,role:'viewer'}]);
  const page=await hit('/chamados');
  assert.match(page.body.toString(),/data-access-role="viewer"/);
  assert.match(page.body.toString(),/rel="manifest" href="\/app.webmanifest"/);
  const manifest=await hit('/app.webmanifest');
  assert.equal(manifest.status,200);
  assert.equal(manifest.headers['cache-control'],'no-store');
  assert.equal(JSON.parse(manifest.body).display,'standalone');
  for(const {src,sizes} of JSON.parse(manifest.body).icons){
    const icon=await hit(src),size=Number(sizes.split('x')[0]);
    assert.equal(icon.status,200);
    assert.equal(icon.body.readUInt32BE(16),size);
    assert.equal(icon.body.readUInt32BE(20),size);
  }
  const allowed=JSON.parse((await hit(casePath)).body);
  assert.equal(allowed.profile.tasks[0].text,'Aguardar peça');
  assert.doesNotMatch(JSON.stringify(allowed),/omit-/);
  assert.equal(JSON.parse((await hit('/api/cases')).body).items[0].profile,undefined);
  const before=calls.length;
  for(const path of [manage,'/configuracao','/historico','/fechamento','/minuta','/api-explorer','/api/cases/history','/api/cases/runtime',casePath+'/attachment/0'])
    assert.equal((await hit(path)).status,403,path);
  assert.equal((await hit(casePath,partner,{kind:'note'})).status,403);
  assert.equal(calls.length,before);
  assert.equal((await hit(manage,login,{login:partner,role:'editor'})).status,200);
  assert.match((await hit('/chamados')).body.toString(),/data-access-role="editor"/);
  for(const kind of ['profile','context','note','task','resolve'])assert.equal((await hit(casePath,partner,{kind})).status,200,kind);
  for(const kind of ['archive','restore','merge','send'])assert.equal((await hit(casePath,partner,{kind})).status,403,kind);
  assert.equal((await hit('/api/cases/closing/package',partner,{})).status,403);
  assert.equal((await hit(casePath+'/photo',partner,{})).status,403);
  assert.equal((await hit(manage,login,{login:partner,role:'viewer'})).status,200);
  assert.equal((await hit(casePath,partner,{kind:'task'})).status,403);
  assert.equal((await hit(manage,login,{login:partner,role:null})).status,200);
  assert.equal((await hit(casePath)).status,403);
  await writeFile(file,'invalid');
  assert.equal((await hit(casePath)).status,403);
  assert.equal((await hit(manage,login)).status,503);
  assert.match((await hit('/chamados',login)).body.toString(),/data-access-role="admin"/);
});
