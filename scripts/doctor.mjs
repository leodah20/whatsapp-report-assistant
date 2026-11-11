import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {CONFIG} from '../src/config.mjs';
const checks=[];
checks.push({check:'Node >=24',ok:Number(process.versions.node.split('.')[0])>=24});
checks.push({check:'Dependências Node',ok:existsSync(join(CONFIG.root,'node_modules/whatsapp-web.js/package.json'))});
checks.push({check:'Navegador instalado',ok:!!CONFIG.chrome});
const python=spawnSync(CONFIG.python,['-c','import sys; import mcp, cryptography; import win32cred; assert sys.version_info >= (3,12); print("ok")'],{encoding:'utf8',windowsHide:true,timeout:15000});
checks.push({check:'Python >=3.12 + dependências Windows',ok:python.status===0});
try{const r=await fetch(CONFIG.ollamaURL+'/api/tags',{signal:AbortSignal.timeout(4000)});const data=await r.json();checks.push({check:'Modelo local disponível',ok:r.ok&&!!data.models?.some(m=>m.name===CONFIG.model||m.name===CONFIG.model+':latest')});}catch{checks.push({check:'Modelo local disponível',ok:false});}
for(const c of checks)console.log(`${c.ok?'OK':'PENDENTE'} — ${c.check}`);
console.log('Sem ler chaves, mensagens, QR ou sessão; não conecta WhatsApp.');
if(checks.some(c=>!c.ok))process.exitCode=1;
