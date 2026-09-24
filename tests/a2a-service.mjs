import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { receiptToA2APart } from '../sdk/client.mjs';

const assert=(c,m)=>{if(!c)throw new Error(m)};
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'a2a-service-'));
const child=spawn(process.execPath,[path.join(root,'server/src/server.js')],{cwd:root,env:{...process.env,PORT:'4139',DATA_DIR:temp},stdio:['ignore','pipe','pipe']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function req(pathname,options){const r=await fetch('http://127.0.0.1:4139'+pathname,options);const text=await r.text();let body=null;try{body=text?JSON.parse(text):null}catch{body=text}return {status:r.status,headers:Object.fromEntries(r.headers),body}}
try{
 await sleep(350);
 const card=await req('/.well-known/agent-card.json');
 assert(card.status===200,'Agent Card unavailable');
 assert(card.body.supportedInterfaces?.[0]?.protocolBinding==='JSONRPC','JSONRPC interface missing');
 assert(card.body.supportedInterfaces?.[0]?.protocolVersion==='1.0','A2A card protocol version mismatch');
 const created=await req('/v1/proof',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'a2a-service-test',policy:'test-only',input:{a:1},output:{ok:true}})});
 const receipt=created.body.receipt; assert(created.status===200 && receipt?.signature,'proof setup failed');
 const message={messageId:crypto.randomUUID(),role:'ROLE_USER',parts:[receiptToA2APart(receipt)]};
 const rpc=await req('/a2a',{method:'POST',headers:{'content-type':'application/json','A2A-Version':'1.0'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'SendMessage',params:{message}})});
 assert(rpc.status===200,'A2A JSONRPC send failed');
 assert(rpc.body.result?.task?.status?.state==='TASK_STATE_COMPLETED','A2A task not completed');
 const task=rpc.body.result.task; const proofPart=task.artifacts?.[0]?.parts?.[0];
 assert(proofPart?.data?.verification?.verified===true,'A2A verification result missing/invalid');
 const got=await req('/a2a',{method:'POST',headers:{'content-type':'application/json','A2A-Version':'1.0'},body:JSON.stringify({jsonrpc:'2.0',id:2,method:'GetTask',params:{id:task.id}})});
 assert(got.body.result?.id===task.id,'A2A GetTask failed');
 const zeroHistory=await req('/a2a',{method:'POST',headers:{'content-type':'application/json','A2A-Version':'1.0'},body:JSON.stringify({jsonrpc:'2.0',id:4,method:'GetTask',params:{id:task.id,historyLength:0}})});
 assert(Array.isArray(zeroHistory.body.result?.history) && zeroHistory.body.result.history.length===0,'A2A historyLength=0 failed');
 const rest=await req('/message:send',{method:'POST',headers:{'content-type':'application/a2a+json','A2A-Version':'1.0'},body:JSON.stringify({message})});
 assert(rest.status===200 && rest.headers['content-type']?.includes('application/a2a+json'),'A2A REST send failed');
 assert(rest.body.task?.status?.state==='TASK_STATE_COMPLETED','A2A REST task not completed');
 const fetched=await req(`/tasks/${encodeURIComponent(rest.body.task.id)}`,{headers:{'A2A-Version':'1.0'}});
 assert(fetched.status===200 && fetched.body.id===rest.body.task.id,'A2A REST GetTask failed');
 const badVersion=await req('/a2a',{method:'POST',headers:{'content-type':'application/json','A2A-Version':'0.3'},body:JSON.stringify({jsonrpc:'2.0',id:3,method:'SendMessage',params:{message}})});
 assert(badVersion.status===400,'A2A unsupported version not rejected');
 console.log(JSON.stringify({ok:true,agentCard:card.body.name,jsonRpcTask:task.id,restTask:rest.body.task.id},null,2));
}finally{child.kill('SIGTERM');fs.rmSync(temp,{recursive:true,force:true})}
