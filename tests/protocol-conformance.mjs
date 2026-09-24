import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const readJson=(url)=>JSON.parse(fs.readFileSync(fileURLToPath(url),'utf8'));
const manifest=readJson(new URL('../config/manifest.json',import.meta.url));
const protocols=readJson(new URL('../config/protocols.json',import.meta.url));
const partSchema=readJson(new URL('../schemas/a2a-receipt-part.schema.json',import.meta.url));

assert(manifest.version==='0.21.1','manifest version mismatch');
assert(protocols.adapters.mcp.referenceVersion==='2026-07-28','MCP reference drift');
assert(protocols.adapters.x402.referenceVersion==='2','x402 reference drift');
assert(protocols.adapters.a2a.referenceVersion==='1.0.0','A2A reference drift');
assert(partSchema.properties.mediaType.const==='application/vnd.machine-commerce-proof+json','A2A media type mismatch');

const projectRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let base=process.env.MCP_TEST_BASE_URL;
let child=null;
let temp=null;
if(!base){
  const port=4147;
  temp=fs.mkdtempSync(path.join(os.tmpdir(),'mcp-conformance-'));
  child=spawn(process.execPath,[path.join(projectRoot,'server/src/server.js')],{
    cwd:projectRoot,
    env:{...process.env,PORT:String(port),DATA_DIR:temp},
    stdio:['ignore','pipe','pipe']
  });
  let stderr='';
  child.stderr.on('data',d=>{stderr+=d.toString()});
  await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>resolve(),2000);
    child.once('error',reject);
    child.stdout.on('data',d=>{if(d.toString().includes('listening on')){clearTimeout(timeout);resolve()}});
  });
  if(child.exitCode!==null) throw new Error(`conformance server exited early: ${stderr}`);
  base=`http://127.0.0.1:${port}`;
}

try{
  const meta={
    'io.modelcontextprotocol/protocolVersion':'2026-07-28',
    'io.modelcontextprotocol/clientInfo':{name:'mcp-conformance-test',version:'0.21.1'},
    'io.modelcontextprotocol/clientCapabilities':{},
  };
  const call=async(method,name,params={})=>{
    const body={jsonrpc:'2.0',id:`${method}-1`,method,params:{_meta:meta}};
    if(method==='tools/call') { body.params.name=name; body.params.arguments=params; }
    else Object.assign(body.params, params);
    const res=await fetch(base+'/mcp',{method:'POST',headers:{'content-type':'application/json','MCP-Protocol-Version':'2026-07-28','Mcp-Method':method,'Mcp-Name':method==='tools/call'?name:method},body:JSON.stringify(body)});
    assert(res.ok,`MCP HTTP ${res.status} for ${method}`);
    return res.json();
  };

  const descriptor=await (await fetch(base+'/.well-known/agent-proof.json')).json();
  assert(descriptor.version==='0.21.1','descriptor version mismatch');
  assert(descriptor.protocols.mcp.status==='implemented-minimal-stateless','MCP status mismatch');
  assert(descriptor.protocols.a2a.status==='implemented-minimal-sync','A2A status mismatch');
  assert(descriptor.protocols.a2a.agentCardPublished===true,'A2A Agent Card should be published');

  const discover=await call('server/discover','server/discover');
  assert(discover.result?.supportedVersions?.includes('2026-07-28'),'MCP discover missing version');
  const list=await call('tools/list','tools/list');
  const names=(list.result?.tools||[]).map(t=>t.name);
  for(const required of ['create_proof','verify_receipt','verify_chain','get_stats']) assert(names.includes(required),`MCP missing tool ${required}`);
  const created=await call('tools/call','create_proof',{action:'interop-test',agentId:'conformance',policy:'test-only',input:{x:1},output:{ok:true}});
  const receipt=created.result?.structuredContent?.receipt;
  assert(receipt?.receiptHash,'MCP create_proof did not return receipt');
  const verify=await call('tools/call','verify_receipt',{receipt});
  assert(verify.result?.structuredContent?.verified===true,'MCP verify_receipt failed');
  const chain=await call('tools/call','verify_chain',{});
  assert(chain.result?.structuredContent?.valid===true,'MCP verify_chain failed');

  console.log(JSON.stringify({ok:true,version:manifest.version,mcpTools:names,a2a:'implemented-minimal-sync',x402:'adapter-boundary'},null,2));
}finally{
  if(child) child.kill('SIGTERM');
  if(temp) fs.rmSync(temp,{recursive:true,force:true});
}
