import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const assert=(c,m)=>{if(!c)throw new Error(m)};
const root=process.cwd();
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'mcp-security-'));
const child=spawn(process.execPath,[path.join(root,'server/src/server.js')],{cwd:root,env:{...process.env,PORT:'4157',DATA_DIR:temp,NODE_ENV:'production',CORS_ORIGIN:'https://example.com',PROOF_WRITE_TOKEN:'write-secret',ADMIN_TOKEN:'admin-secret',RATE_LIMIT_MAX:'5',RATE_LIMIT_WINDOW_MS:'60000'},stdio:['ignore','pipe','pipe']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function req(pathname, options={}){const r=await fetch('http://127.0.0.1:4157'+pathname,options);const text=await r.text();let body=null;try{body=text?JSON.parse(text):null}catch{body=text};return {status:r.status,body,headers:Object.fromEntries(r.headers)}}
const post=(pathname,body,headers={})=>req(pathname,{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)});
try{
  await sleep(350);
  const health=await req('/health');
  assert(health.status===200,'health');
  assert(health.body.security?.production===true,'production flag');
  assert(health.body.security?.corsConfigured===true,'cors flag');
  assert(health.body.security?.proofWriteAuthConfigured===true,'write auth flag');
  assert(health.body.security?.adminAuthConfigured===true,'admin auth flag');
  assert(health.headers['x-content-type-options']==='nosniff','security header');
  assert(health.headers['x-frame-options']==='DENY','frame header');
  assert(health.headers['x-request-id'],'request id');
  assert((await req('/health',{headers:{origin:'https://example.com'}})).headers['access-control-allow-origin']==='https://example.com','cors allow');

  const deniedWrite=await post('/v1/proof',{action:'security-test'});
  assert(deniedWrite.status===401 && deniedWrite.body.error==='unauthorized','write auth');
  const created=await post('/v1/proof',{action:'security-test',policy:'test-only',input:{a:1},output:{ok:true}},{authorization:'Bearer write-secret'});
  assert(created.status===200 && created.body.receipt?.signature,'authorized write');

  const deniedList=await req('/v1/receipts');
  assert(deniedList.status===401,'admin list auth');
  const allowedList=await req('/v1/receipts',{headers:{authorization:'Bearer admin-secret'}});
  assert(allowedList.status===200 && allowedList.body.count===1,'admin list');

  const mcpMeta={
    'MCP-Protocol-Version':'2026-07-28', 'Mcp-Method':'tools/call', 'Mcp-Name':'create_proof'
  };
  const mcpBody={jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'create_proof',arguments:{action:'mcp-security-test'},_meta:{'io.modelcontextprotocol/protocolVersion':'2026-07-28','io.modelcontextprotocol/clientInfo':{name:'security-test',version:'1'},'io.modelcontextprotocol/clientCapabilities':{}}}};
  const mcpDenied=await req('/mcp',{method:'POST',headers:{'content-type':'application/json',...mcpMeta},body:JSON.stringify(mcpBody)});
  assert(mcpDenied.status===401,'MCP write auth');

  console.log(JSON.stringify({ok:true,security:{headers:true,cors:true,writeAuth:true,adminAuth:true,mcpWriteAuth:true}},null,2));
}finally{child.kill('SIGTERM');fs.rmSync(temp,{recursive:true,force:true})}
