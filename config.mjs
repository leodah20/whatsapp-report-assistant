import{existsSync}from'node:fs';
import{dirname,join,resolve}from'node:path';
import{fileURLToPath}from'node:url';
export const ROOT=dirname(fileURLToPath(import.meta.url));
if(existsSync(join(ROOT,'.env.local')))process.loadEnvFile(join(ROOT,'.env.local'));
function integer(name,fallback,min,max){const n=Number(process.env[name]||fallback);if(!Number.isInteger(n)||n<min||n>max)throw Error(`Configuração inválida: ${name}`);return n;}
const localAI=new URL(process.env.REPORT_OLLAMA_URL||'http://127.0.0.1:11434');
if(localAI.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(localAI.hostname)||localAI.username||localAI.password||localAI.search||localAI.hash||!['','/'].includes(localAI.pathname))throw Error('A IA do coletor deve usar um endereço HTTP local, sem credenciais na URL.');
const chromeCandidates=[process.env.REPORT_CHROME_PATH,join(process.env.PROGRAMFILES||'C:/Program Files','Google/Chrome/Application/chrome.exe'),join(process.env['PROGRAMFILES(X86)']||'C:/Program Files (x86)','Microsoft/Edge/Application/msedge.exe'),'/usr/bin/google-chrome','/usr/bin/chromium'].filter(Boolean);
const venvPython=process.platform==='win32'?join(ROOT,'.venv/Scripts/python.exe'):join(ROOT,'.venv/bin/python');
const sessionId=process.env.REPORT_SESSION_ID||'reports';
if(!/^[a-zA-Z0-9_-]{1,64}$/.test(sessionId))throw Error('REPORT_SESSION_ID inválido');
export const CONFIG=Object.freeze({
  root:ROOT,dataDir:resolve(ROOT,process.env.REPORT_DATA_DIR||'data'),
  port:integer('REPORT_PORT',8767,1024,65535),
  python:process.env.REPORT_PYTHON||(existsSync(venvPython)?venvPython:process.platform==='win32'?'python':'python3'),
  chrome:chromeCandidates.find(p=>existsSync(p)),
  ollamaURL:localAI.origin,model:process.env.REPORT_MODEL||'qwen3:4b',
  context:integer('REPORT_CONTEXT',4096,1024,32768),threads:integer('REPORT_THREADS',4,1,32),
  modelTimeout:integer('REPORT_MODEL_TIMEOUT_MS',600000,10000,900000),
  keyTarget:process.env.REPORT_KEY_TARGET||'WhatsAppReportAssistant/ArchiveKey-v1',sessionId
});
