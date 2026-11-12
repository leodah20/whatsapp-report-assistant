import {readFileSync, writeFileSync, renameSync, unlinkSync} from 'node:fs';
import {randomUUID} from 'node:crypto';

export const collaboratorRoles=new Set(['viewer','editor']);
export const validLogin=value=>typeof value==='string'&&value.length<=254&&/^[a-z0-9._%+-]+@[a-z0-9][a-z0-9.-]*$/i.test(value);
const limit=50;

export function createAccessStore(file){
  function list(){
    let raw;
    try{raw=readFileSync(file,'utf8');}
    catch(error){if(error.code==='ENOENT')return new Map();throw error;}
    if(raw.length>20000)throw Error('Arquivo de acessos inválido.');
    const rows=JSON.parse(raw);
    if(!Array.isArray(rows)||rows.length>limit||rows.some(r=>!validLogin(r?.login)||!collaboratorRoles.has(r.role)))
      throw Error('Arquivo de acessos inválido.');
    const users=new Map(rows.map(r=>[r.login,r.role]));
    if(users.size!==rows.length)throw Error('Arquivo de acessos inválido.');
    return users;
  }
  return {list,change(login,role){
    const users=list();
    if(role===null)users.delete(login);else users.set(login,role);
    if(users.size>limit)return false;
    const tmp=file+'.'+randomUUID()+'.tmp';
    try{
      writeFileSync(tmp,JSON.stringify([...users].map(([login,role])=>({login,role})),null,2)+'\n',{flag:'wx',mode:0o600});
      renameSync(tmp,file);
    }finally{try{unlinkSync(tmp);}catch{/* File has already been moved or was not created. */}}
    return true;
  }};
}

const summaryKeys=['code','title','location','locationConfirmed','serviceDay','referenceAt','summary','area','areaSuggested','status','stage','version','contextState','missing','openTasks','archived','carryover','updatedAt'];
const pick=(value,keys)=>Object.fromEntries(keys.filter(k=>Object.hasOwn(value,k)).map(k=>[k,value[k]]));
const summary=row=>({...pick(row,summaryKeys),sourceCount:0,...(row.externalTicket?{externalTicket:pick(row.externalTicket,['lastState'])}:{})});

export function collaboratorData(path,data){
  if(path==='/api/cases')return {...pick(data,['month','areas','statuses','months']),items:data.items.map(summary)};
  const p=data.profile;
  return {...summary(data),stageQuestion:data.stageQuestion,
    profile:{...pick(p,['title','location','serviceDay','area','status','stageReason','scheduledFor','archived','answers']),
      tasks:p.tasks.map(t=>pick(t,['id','text','occurredOn','resolvedAt','resolvedOn','resolution'])),
      events:p.events.filter(e=>['profile','context','note','task','resolve','archive','restore'].includes(e.kind))
        .map(e=>pick(e,['kind','registeredAt','occurredOn','before','after','text','taskText']))},
    facts:data.facts.map(f=>pick(f,['field','quote','confirmed','prior','automatic','origin','recordedAt'])),sources:[],notices:[]};
}
