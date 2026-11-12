import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {join} from 'node:path';
import {promisify} from 'node:util';
import {localDay} from './board.mjs';
import {open,seal} from '../core.mjs';

const run=promisify(execFile);
const hash=s=>createHash('sha256').update(s).digest('hex');
const sender='atendimento@invenzi.movidesk.com';
const checkpointKey='support-mail:invenzi';
const fromAddress=value=>String(value||'').trim().toLowerCase().match(/^(?:[^<>]{0,200}<)?(atendimento@invenzi\.movidesk\.com)>?$/)?.[1];
const validDay=value=>typeof value==='string'&&/^20\d{2}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(Date.parse(value)).toISOString().slice(0,10)===value;

export function parseSupportMail(message){
  if(fromAddress(message?.from)!==sender||typeof message.text!=='string'||typeof message.message_id!=='string')return null;
  const id=message.message_id.trim();
  if(!/^<[^<>\s]{1,240}>$/.test(id))return null;
  const at=Date.parse(message.date);
  if(!Number.isFinite(at)||at>Date.now()+86400000)return null;
  const normalized=message.text.slice(0,16000).replace(/\u00a0/g,' ').replace(/\r/g,'');
  const header=normalized.slice(0,1200).match(/^[ \t]*(?:o[ \t]+)?ticket[ \t]+n[º°o.]\.?[ \t]*(\d{1,12})\b[^\n]*$/im);
  if(!header)return null;
  const ticket=header[1];
  const rawSubject=String(message.subject||'').replace(/[\r\n\x00-\x1f]/g,' ').trim();
  const subject=rawSubject.replace(/^(?:(?:re|resolvido|enc|fw|fwd|novo ticket)\s*:\s*)+/iu,'').slice(0,150);
  if(!subject)return null;
  const body=normalized.slice(header.index+header[0].length).trim()
    .replace(/https?:\/\/\S+/giu,'[link omitido]').slice(0,6000);
  const state=/^resolvido\s*:/iu.test(rawSubject)?'resolvido':'atualizado';
  return {id:'mail:'+hash(id),ticket,subject,state,month:localDay(at).slice(0,7),timestamp:Math.floor(at/1000),
    text:(header[0].trim().replace(/https?:\/\/\S+/giu,'[link omitido]')+'\n\n'+body).trim(),
    type:'chat',hasMedia:false,channel:'support-email',provider:'Invenzi'};
}

export function createSupportMail({db,key,assistant,since,python,root,enabled=()=>true,fetchBatch,now=()=>Date.now()}){
  if(!validDay(since))return null;
  db.exec('CREATE TABLE IF NOT EXISTS support_mail_state (id TEXT PRIMARY KEY, payload BLOB NOT NULL); CREATE TABLE IF NOT EXISTS support_mail_messages (id TEXT PRIMARY KEY,month TEXT NOT NULL,ts INTEGER NOT NULL,payload BLOB NOT NULL)');
  const load=()=>{const row=db.prepare('SELECT payload FROM support_mail_state WHERE id=?').get(checkpointKey);
    const saved=row?JSON.parse(open(key,row.payload,checkpointKey)):null;
    return saved?.since===since?saved:{uidvalidity:'',cursor:0};};
  const write=state=>db.prepare('INSERT INTO support_mail_state VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').run(checkpointKey,seal(key,Buffer.from(JSON.stringify(state)),checkpointKey));
  const fetch=fetchBatch||((state)=>run(python,[join(root,'integrations/mcp/support_mail.py'),since,state.uidvalidity,String(state.cursor)],{timeout:70000,maxBuffer:768*1024,windowsHide:true,encoding:'utf8'}).then(r=>JSON.parse(r.stdout)));
  const status={state:'ready',lastRun:null,added:0,needsReview:0};
  let busy=false;
  async function sync(){
    if(busy||!enabled())return;
    busy=true;status.state='syncing';
    try{
      const checkpoint=load(),data=await fetch(checkpoint);
      if(!enabled())return;
      if(!data||!/^\d{1,16}$/.test(data.uidvalidity)||!Number.isSafeInteger(data.cursor)||data.cursor<0||
        (data.uidvalidity===checkpoint.uidvalidity&&data.cursor<checkpoint.cursor)||!Array.isArray(data.messages)||data.messages.length>20)throw Error();
      let added=0,needsReview=0;
      db.exec('BEGIN IMMEDIATE');
      try{
        const items=assistant.all(),byId=new Map(items.map(i=>[i.id,i]));
        for(const message of data.messages){
          if(typeof message?.uid!=='string'||!/^\d{1,10}$/.test(message.uid)||Number(message.uid)>data.cursor||
            (data.uidvalidity===checkpoint.uidvalidity&&Number(message.uid)<=checkpoint.cursor))throw Error();
          const record=parseSupportMail(message);
          if(!record){needsReview++;continue;}
          if(localDay(record.timestamp*1000)<since)continue;
          if(db.prepare('SELECT 1 FROM support_mail_messages WHERE id=?').get(record.id))continue;
          const identity='support-ticket:'+hash('invenzi:'+record.ticket);
          let item=byId.get(identity);
          const visited=new Set();
          while(item?.mergedInto&&!visited.has(item.id)){visited.add(item.id);item=byId.get(item.mergedInto);}
          if(visited.size&&(!item||item.mergedInto))throw Error();
          if(!item){
            const used=new Set([...byId.values()].map(i=>i.code));
            let code='R-'+hash(identity).slice(0,8).toUpperCase();
            while(used.has(code))code='R-'+hash(code+identity).slice(0,8).toUpperCase();
            item={id:identity,code,month:record.month,sourceIds:[],answerIds:[],facts:[{field:'ocorrencia',quote:record.subject}],missing:['local','equipamento','procedimento','resultado'],
              historical:true,review:'needs-review',questionState:'silent',intakeState:'silent',createdAt:new Date(now()).toISOString(),
              externalTicket:{provider:'Invenzi',number:record.ticket,subject:record.subject}};
          }
          db.prepare('INSERT INTO support_mail_messages (id,month,ts,payload) VALUES(?,?,?,?)').run(record.id,record.month,record.timestamp,seal(key,Buffer.from(JSON.stringify(record)),record.id));
          item.sourceIds=[...new Set([...item.sourceIds,record.id])];
          if(item.externalTicket&&record.timestamp>=(item.externalTicket.lastAt||0)){
            item.externalTicket={...item.externalTicket,lastAt:record.timestamp,lastState:record.state};
          }
          item.updatedAt=new Date(now()).toISOString();
          assistant.save(item);byId.set(item.id,item);added++;
        }
        write({uidvalidity:data.uidvalidity,cursor:data.cursor,since});db.exec('COMMIT');
      }catch(e){db.exec('ROLLBACK');throw e;}
      status.lastRun=new Date(now()).toISOString();status.added=added;status.needsReview+=needsReview;status.state=data.more?'backlog':'ready';
    }catch{status.state='error';}
    finally{busy=false;if(status.state==='syncing')status.state='ready';}
  }
  return {sync,status:()=>({...status})};
}
