const enc = new TextEncoder();
const dec = new TextDecoder();
const VERSION = '0.21.1';
const MCP_PROTOCOL_VERSION = '2026-07-28';
const SCHEMA = 'mcp-receipt-v0.4';

function canonical(value) {
  if (value === null) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
}

function b64(bytes) {
  let s = '';
  for (const byte of new Uint8Array(bytes)) s += String.fromCharCode(byte);
  return btoa(s);
}

function fromB64(s) {
  const bin = atob(s);
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

async function sha256Hex(value) {
  const input = typeof value === 'string' ? value : canonical(value);
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(input));
  return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('');
}

async function loadPrivateKey(env) {
  if (!env.ED25519_PRIVATE_PKCS8_B64) throw new Error('ED25519_PRIVATE_PKCS8_B64 not configured');
  return crypto.subtle.importKey('pkcs8', fromB64(env.ED25519_PRIVATE_PKCS8_B64), {name: 'Ed25519'}, false, ['sign']);
}

async function loadPublicKey(env) {
  if (!env.ED25519_PUBLIC_SPKI_B64) throw new Error('ED25519_PUBLIC_SPKI_B64 not configured');
  return crypto.subtle.importKey('spki', fromB64(env.ED25519_PUBLIC_SPKI_B64), {name: 'Ed25519'}, false, ['verify']);
}

function without(receipt, ...fields) {
  const copy = {...receipt, signer: receipt.signer ? {...receipt.signer} : receipt.signer};
  for (const field of fields) delete copy[field];
  if (copy.signer) { delete copy.signer.publicKeyPem; delete copy.signer.publicKeySpkiB64; }
  return copy;
}

function json(status, body, headers = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      ...headers
    }
  });
}

async function makeReceipt(env, payload) {
  const previous = await env.DB.prepare('SELECT receipt_hash FROM receipts ORDER BY id DESC LIMIT 1').first();
  const receipt = {
    schema: SCHEMA,
    runId: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    agentId: String(payload.agentId || 'worker-agent'),
    action: String(payload.action || 'proof'),
    policy: String(payload.policy || 'unspecified'),
    inputHash: `sha256:${await sha256Hex(payload.input ?? null)}`,
    outputHash: `sha256:${await sha256Hex(payload.output ?? null)}`,
    paymentId: payload.paymentId || null,
    payment: payload.payment || null,
    provenance: {inputTrust: 'untrusted', attestationScope: 'integrity-only'},
    previousReceiptHash: previous?.receipt_hash || null,
    signer: {
      algorithm: 'Ed25519',
      keyFingerprint: env.ED25519_PUBLIC_FINGERPRINT || null,
      publicKeySpkiB64: env.ED25519_PUBLIC_SPKI_B64 || null
    }
  };
  receipt.receiptHash = `sha256:${await sha256Hex(receipt)}`;
  const key = await loadPrivateKey(env);
  const signature = await crypto.subtle.sign('Ed25519', key, enc.encode(canonical(without(receipt, 'signature'))));
  receipt.signature = b64(signature);

  await env.DB.prepare(
    `INSERT INTO receipts (run_id,created_at,receipt_hash,previous_receipt_hash,agent_id,action,receipt_json) VALUES (?,?,?,?,?,?,?)`
  ).bind(
    receipt.runId,
    receipt.createdAt,
    receipt.receiptHash,
    receipt.previousReceiptHash,
    receipt.agentId,
    receipt.action,
    JSON.stringify(receipt)
  ).run();
  return receipt;
}

async function verifyReceipt(receipt) {
  if (!receipt?.signer?.publicKeySpkiB64 || !receipt?.signature || !receipt?.receiptHash) return {verified: false, error: 'invalid_receipt'};
  try {
    const rawKey = fromB64(receipt.signer.publicKeySpkiB64);
    const publicKey = await crypto.subtle.importKey('spki', rawKey, {name: 'Ed25519'}, false, ['verify']);
    const fingerprintBytes = await crypto.subtle.digest('SHA-256', rawKey);
    const fingerprint = [...new Uint8Array(fingerprintBytes)].map(x => x.toString(16).padStart(2, '0')).join('').slice(0, 32);
    const hashValid = receipt.receiptHash === `sha256:${await sha256Hex(without(receipt, 'receiptHash', 'signature'))}`;
    const signatureValid = await crypto.subtle.verify('Ed25519', publicKey, fromB64(receipt.signature), enc.encode(canonical(without(receipt, 'signature'))));
    const fingerprintValid = fingerprint === receipt.signer.keyFingerprint;
    return {verified: hashValid && signatureValid && fingerprintValid, hashValid, signatureValid, signerFingerprintValid: fingerprintValid, keyFingerprint: fingerprint, attestationScope: receipt.provenance?.attestationScope || 'unspecified'};
  } catch {
    return {verified: false, error: 'verification_error'};
  }
}

const MCP_TOOLS = [
  {
    name: 'create_proof', title: 'Create Proof Receipt',
    description: 'Create a signed, tamper-evident receipt for an agent action.',
    inputSchema: { $schema: 'https://json-schema.org/draft/2020-12/schema', type: 'object', properties: { agentId: {type:'string'}, action:{type:'string'}, policy:{type:'string'}, input:{}, output:{}, paymentId:{type:['string','null']}, payment:{} }, required:['action'], additionalProperties:true },
    outputSchema: { $schema:'https://json-schema.org/draft/2020-12/schema', type:'object', properties:{ok:{const:true},receipt:{type:'object'}}, required:['ok','receipt'], additionalProperties:false }
  },
  {
    name: 'verify_receipt', title: 'Verify Receipt',
    description: 'Independently verify receipt integrity, signature and signer fingerprint.',
    inputSchema: { $schema:'https://json-schema.org/draft/2020-12/schema', type:'object', properties:{receipt:{type:'object'}}, required:['receipt'], additionalProperties:false },
    outputSchema: { $schema:'https://json-schema.org/draft/2020-12/schema', type:'object', properties:{verified:{type:'boolean'},hashValid:{type:'boolean'},signatureValid:{type:'boolean'},signerFingerprintValid:{type:'boolean'},keyFingerprint:{type:'string'},attestationScope:{type:'string'}}, required:['verified'], additionalProperties:true }
  },
  {
    name: 'verify_chain', title: 'Verify Receipt Chain',
    description: 'Verify the append-only receipt chain stored in D1.',
    inputSchema: { $schema:'https://json-schema.org/draft/2020-12/schema', type:'object', additionalProperties:false },
    outputSchema: { $schema:'https://json-schema.org/draft/2020-12/schema', type:'object', properties:{valid:{type:'boolean'},count:{type:'integer'},errors:{type:'array'}}, required:['valid','count','errors'], additionalProperties:false }
  },
  {
    name: 'get_stats', title: 'Get Proof Statistics',
    description: 'Return receipt count and chain validity.',
    inputSchema: { $schema:'https://json-schema.org/draft/2020-12/schema', type:'object', additionalProperties:false },
    outputSchema: { $schema:'https://json-schema.org/draft/2020-12/schema', type:'object', properties:{receipts:{type:'integer'},verifiedChain:{type:'boolean'},schema:{type:'string'}}, required:['receipts','verifiedChain','schema'], additionalProperties:false }
  }
];

function mcpEnvelope(id, result) {
  return { jsonrpc:'2.0', id, result:{ resultType:'complete', _meta:{'io.modelcontextprotocol/serverInfo':{name:'machine-commerce-proof',version:VERSION}}, ...result } };
}
function mcpError(id, code, message, data=undefined) {
  const error={code,message}; if(data!==undefined) error.data=data; return {jsonrpc:'2.0',id:id??null,error};
}
function mcpValidate(request) {
  const meta=request?.params?._meta;
  if(!meta || meta['io.modelcontextprotocol/protocolVersion']!==MCP_PROTOCOL_VERSION) return 'invalid_request_meta';
  if(!meta['io.modelcontextprotocol/clientInfo'] || !meta['io.modelcontextprotocol/clientCapabilities']) return 'invalid_request_meta';
  return null;
}
async function mcpChain(env) {
  const result=await env.DB.prepare('SELECT id, receipt_json FROM receipts ORDER BY id ASC').all();
  let previousHash=null; const errors=[];
  for(const row of result.results){
    const receipt=JSON.parse(row.receipt_json); const verification=await verifyReceipt(receipt);
    if(!verification.verified) errors.push({id:row.id,runId:receipt.runId,error:'receipt_invalid',details:verification});
    if(receipt.previousReceiptHash!==previousHash) errors.push({id:row.id,runId:receipt.runId,error:'chain_link_mismatch'});
    previousHash=receipt.receiptHash;
  }
  return {valid:errors.length===0,count:result.results.length,errors};
}
async function handleMcp(request, env, payload) {
  if(!payload || payload.jsonrpc!=='2.0' || payload.id===undefined || typeof payload.method!=='string') return new Response(JSON.stringify(mcpError(payload?.id,-32600,'Invalid Request')),{status:400,headers:{'content-type':'application/json'}});
  if(request.headers.get('MCP-Protocol-Version')!==MCP_PROTOCOL_VERSION) return new Response(JSON.stringify(mcpError(payload.id,-32600,'unsupported_protocol_version')),{status:400,headers:{'content-type':'application/json'}});
  if(!payload.params || request.headers.get('Mcp-Method')!==payload.method || !request.headers.get('Mcp-Name')) return new Response(JSON.stringify(mcpError(payload.id,-32600,'mcp_headers_invalid')),{status:400,headers:{'content-type':'application/json'}});
  if(payload.method==='tools/call' && request.headers.get('Mcp-Name')!==payload.params.name) return new Response(JSON.stringify(mcpError(payload.id,-32600,'mcp_name_mismatch')),{status:400,headers:{'content-type':'application/json'}});
  if(payload.method!=='tools/call' && request.headers.get('Mcp-Name')!==payload.method) return new Response(JSON.stringify(mcpError(payload.id,-32600,'mcp_name_mismatch')),{status:400,headers:{'content-type':'application/json'}});
  const metaError=mcpValidate(payload); if(metaError) return new Response(JSON.stringify(mcpError(payload.id,-32600,metaError)),{status:400,headers:{'content-type':'application/json'}});
  const jsonOut=(body,status=200,headers={})=>new Response(JSON.stringify(body,null,2),{status,headers:{'content-type':'application/json; charset=utf-8','access-control-allow-origin':'*',...headers}});
  if(payload.method==='server/discover') return jsonOut(mcpEnvelope(payload.id,{supportedVersions:[MCP_PROTOCOL_VERSION],capabilities:{tools:{listChanged:false},resources:{},prompts:{}},ttlMs:3600000,cacheScope:'public'}),200,{'cache-control':'public, max-age=3600'});
  if(payload.method==='tools/list') return jsonOut(mcpEnvelope(payload.id,{tools:[...MCP_TOOLS].sort((a,b)=>a.name.localeCompare(b.name)),ttlMs:3600000,cacheScope:'public'}),200,{'cache-control':'public, max-age=3600'});
  if(payload.method!=='tools/call') return jsonOut(mcpError(payload.id,-32601,'Method not found'));
  const args=payload.params.arguments && typeof payload.params.arguments==='object' ? payload.params.arguments:{}; let value;
  try{
    if(payload.params.name==='create_proof'){if(!args.action) return jsonOut(mcpError(payload.id,-32602,'action is required')); value={ok:true,receipt:await makeReceipt(env,args)};}
    else if(payload.params.name==='verify_receipt'){if(!args.receipt || typeof args.receipt!=='object') return jsonOut(mcpError(payload.id,-32602,'receipt object is required')); value=await verifyReceipt(args.receipt);}
    else if(payload.params.name==='verify_chain') value=await mcpChain(env);
    else if(payload.params.name==='get_stats'){const row=await env.DB.prepare('SELECT COUNT(*) AS count FROM receipts').first(); value={receipts:Number(row?.count||0),verifiedChain:(await mcpChain(env)).valid,schema:SCHEMA};}
    else return jsonOut(mcpError(payload.id,-32602,`Unknown tool: ${payload.params.name}`));
  }catch(err){return jsonOut(mcpError(payload.id,-32603,'Internal error',{message:err instanceof Error?err.message:String(err)}));}
  return jsonOut(mcpEnvelope(payload.id,{content:[{type:'text',text:JSON.stringify(value)}],structuredContent:value}));
}

function paymentRequired(request, env) {
  const origin = new URL(request.url).origin;
  const requirement = {
    scheme: env.X402_SCHEME || 'exact',
    network: env.X402_NETWORK,
    amount: env.X402_AMOUNT,
    asset: env.X402_ASSET,
    payTo: env.X402_PAY_TO,
    maxTimeoutSeconds: Number(env.X402_MAX_TIMEOUT || 60),
    extra: {name: 'USDC', version: '2'}
  };
  const body = {
    x402Version: 2,
    resource: {
      url: `${origin}/v1/proof/deep`,
      description: 'Premium Machine Commerce Proof verification',
      mimeType: 'application/json',
      serviceName: 'Machine Commerce Proof',
      tags: ['agent', 'proof', 'verification']
    },
    accepts: [requirement],
    extensions: {}
  };
  return {body, requirement};
}

async function facilitator(env, endpoint, payload) {
  if (!env.X402_FACILITATOR_URL) throw new Error('X402_FACILITATOR_URL not configured');
  const res = await fetch(`${env.X402_FACILITATOR_URL.replace(/\/$/, '')}/${endpoint}`, {
    method: 'POST',
    headers: {'content-type': 'application/json', ...(env.X402_FACILITATOR_AUTH ? {'authorization': env.X402_FACILITATOR_AUTH} : {})},
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  return {ok: res.ok, data};
}


async function workerAudit(env) {
  const rows = await env.DB.prepare('SELECT id, receipt_json FROM receipts ORDER BY id DESC LIMIT 1').all();
  const countRow = await env.DB.prepare('SELECT COUNT(*) AS count FROM receipts').first();
  const chain = await mcpChain(env);
  const latest = rows.results?.[0] ? JSON.parse(rows.results[0].receipt_json) : null;
  return {
    service: 'machine-commerce-proof', version: VERSION, schema: SCHEMA,
    generatedAt: new Date().toISOString(), operationalState: chain.valid ? 'healthy' : 'degraded',
    attestation: {scope:'integrity-only', inputTrust:'untrusted'},
    receipts: {count:Number(countRow?.count||0), chainValid:chain.valid, chainErrorCount:chain.errors.length,
      latest: latest ? {runId:latest.runId, createdAt:latest.createdAt, agentId:latest.agentId, action:latest.action, receiptHash:latest.receiptHash, previousReceiptHash:latest.previousReceiptHash}:null},
    signer: {algorithm:'Ed25519', fingerprint:env.ED25519_PUBLIC_FINGERPRINT||null},
    protocols: {
      mcp:{version:MCP_PROTOCOL_VERSION,status:'implemented-minimal-stateless'},
      a2a:{version:'1.0',status:'mapping-only',note:'Worker profile does not implement A2A task endpoints.'},
      x402:{version:'2',status:Boolean(env.X402_FACILITATOR_URL&&env.X402_ASSET&&env.X402_PAY_TO)?'configured':'adapter-ready-disabled-by-default'},
      erc8004:{status:'mapping-only'}
    },
    privacy:{latestReceiptPayloadExcluded:true,paymentDetailsExcluded:true,rawInputsExcluded:true,rawOutputsExcluded:true}
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, {status: 204, headers: {'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type,PAYMENT-SIGNATURE,MCP-Protocol-Version,Mcp-Method,Mcp-Name'}});
    if (url.pathname === '/mcp' && request.method === 'POST') {
      let parsedPayload;
      try { parsedPayload = await request.json(); } catch { return new Response(JSON.stringify(mcpError(null,-32600,'Invalid Request')),{status:400,headers:{'content-type':'application/json'}}); }
      return handleMcp(request, env, parsedPayload);
    }
    if (url.pathname === '/health') return json(200, {ok: true, service: 'machine-commerce-proof', version: VERSION, runtime: 'cloudflare-workers'});
    if (url.pathname === '/.well-known/agent-proof.json') return json(200, {
      type: 'machine-commerce-proof-service', version: VERSION, receiptSchema: SCHEMA, apiVersion: 'v1',
      capabilities: ['signed-receipts', 'independent-verification', 'chain-verification', 'payment-correlation'],
      payments: {x402: {supported: Boolean(env.X402_FACILITATOR_URL && env.X402_ASSET && env.X402_PAY_TO && env.ED25519_PRIVATE_PKCS8_B64 && env.ED25519_PUBLIC_SPKI_B64), productionPath: Boolean(env.X402_FACILITATOR_URL && env.X402_ASSET && env.X402_PAY_TO && env.ED25519_PRIVATE_PKCS8_B64 && env.ED25519_PUBLIC_SPKI_B64)}, preferredSettlement: 'USDC'},
      attestation: {scope: 'integrity-only', inputTrust: 'untrusted'}, identity: {erc8004Compatible: true},
      protocols: {
        mcp: {version: MCP_PROTOCOL_VERSION, status: 'implemented-minimal-stateless'},
        x402: {version: '2', status: Boolean(env.X402_FACILITATOR_URL && env.X402_ASSET && env.X402_PAY_TO) ? 'configured' : 'adapter-ready-disabled-by-default'},
        a2a: {version: '1.0', status: 'mapping-only', agentCardPublished: false, note: 'Worker profile does not yet implement A2A tasks.'},
        erc8004: {status: 'mapping-only', implementationClaim: false}
      },
      publicKey: {algorithm: 'Ed25519', fingerprint: env.ED25519_PUBLIC_FINGERPRINT || null, publicKeySpkiB64: env.ED25519_PUBLIC_SPKI_B64 || null}
    });

    if (url.pathname === '/v1/public-key' && request.method === 'GET') return json(200, {algorithm: 'Ed25519', fingerprint: env.ED25519_PUBLIC_FINGERPRINT || null, publicKeySpkiB64: env.ED25519_PUBLIC_SPKI_B64 || null});

    if (url.pathname === '/v1/stats' && request.method === 'GET') {
      const row = await env.DB.prepare('SELECT COUNT(*) AS count FROM receipts').first();
      const chain = await (async () => {
        const result = await env.DB.prepare('SELECT id, receipt_json FROM receipts ORDER BY id ASC').all();
        let previousHash = null;
        let valid = true;
        for (const item of result.results) {
          const receipt = JSON.parse(item.receipt_json);
          const verification = await verifyReceipt(receipt);
          if (!verification.verified || receipt.previousReceiptHash !== previousHash) { valid = false; break; }
          previousHash = receipt.receiptHash;
        }
        return valid;
      })();
      return json(200, {receipts: Number(row?.count || 0), verifiedChain: chain, schema: SCHEMA, runtime: 'cloudflare-workers'});
    }

    if (url.pathname === '/v1/receipts' && request.method === 'GET') {
      const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 50), 1), 200);
      const result = await env.DB.prepare('SELECT receipt_json FROM receipts ORDER BY id DESC LIMIT ?').bind(limit).all();
      return json(200, {count: result.results.length, receipts: result.results.map(r => JSON.parse(r.receipt_json)).reverse()});
    }

    if (url.pathname === '/v1/audit' && request.method === 'GET') return json(200, await workerAudit(env));

    if (url.pathname.startsWith('/v1/receipt/') && url.pathname.endsWith('/verification') && request.method === 'GET') {
      const base = '/v1/receipt/';
      const runId = decodeURIComponent(url.pathname.slice(base.length, -'/verification'.length));
      const row = await env.DB.prepare('SELECT receipt_json FROM receipts WHERE run_id = ?').bind(runId).first();
      if (!row) return json(404, {error:'receipt_not_found'});
      const receipt = JSON.parse(row.receipt_json);
      return json(200, {runId, receiptHash:receipt.receiptHash, verification:await verifyReceipt(receipt)});
    }

    if (url.pathname.startsWith('/v1/receipt/') && request.method === 'GET') {
      const runId = decodeURIComponent(url.pathname.slice('/v1/receipt/'.length));
      const row = await env.DB.prepare('SELECT receipt_json FROM receipts WHERE run_id = ?').bind(runId).first();
      if (!row) return json(404, {error: 'receipt_not_found'});
      return json(200, JSON.parse(row.receipt_json));
    }

    if (url.pathname === '/v1/verify' && request.method === 'POST') {
      const input = await request.json();
      const receipt = input?.receipt && typeof input.receipt === 'object' ? input.receipt : input;
      return json(200, await verifyReceipt(receipt));
    }

    if (url.pathname === '/v1/verify-chain' && request.method === 'GET') {
      const result = await env.DB.prepare('SELECT id, receipt_json FROM receipts ORDER BY id ASC').all();
      let previousHash = null;
      const errors = [];
      for (const row of result.results) {
        const receipt = JSON.parse(row.receipt_json);
        const verification = await verifyReceipt(receipt);
        if (!verification.verified) errors.push({id: row.id, runId: receipt.runId, error: 'receipt_invalid', details: verification});
        if (receipt.previousReceiptHash !== previousHash) errors.push({id: row.id, runId: receipt.runId, error: 'chain_link_mismatch'});
        previousHash = receipt.receiptHash;
      }
      return json(200, {valid: errors.length === 0, count: result.results.length, errors});
    }

    if (url.pathname === '/v1/proof' && request.method === 'POST') {
      const input = await request.json();
      if (!input?.action) return json(400, {error: 'action is required'});
      return json(200, {ok: true, receipt: await makeReceipt(env, input)});
    }

    if (url.pathname === '/v1/proof/deep' && request.method === 'POST') {
      const configured = Boolean(env.X402_FACILITATOR_URL && env.X402_ASSET && env.X402_PAY_TO && env.ED25519_PRIVATE_PKCS8_B64 && env.ED25519_PUBLIC_SPKI_B64);
      if (!configured) return json(503, {error: 'x402_not_configured'});
      const {body, requirement} = paymentRequired(request, env);
      const paymentHeader = request.headers.get('PAYMENT-SIGNATURE');
      if (!paymentHeader) return json(402, body, {'PAYMENT-REQUIRED': b64(enc.encode(JSON.stringify(body))), 'cache-control': 'no-store'});
      let paymentPayload;
      try { paymentPayload = JSON.parse(dec.decode(fromB64(paymentHeader))); }
      catch { return json(402, {error: 'invalid_payment_signature_header'}, {'PAYMENT-REQUIRED': b64(enc.encode(JSON.stringify(body)))}); }
      const verify = await facilitator(env, 'verify', {x402Version: 2, paymentPayload, paymentRequirements: requirement});
      if (!verify.ok || !verify.data?.isValid) return json(402, {error: 'payment_invalid'}, {'PAYMENT-REQUIRED': b64(enc.encode(JSON.stringify(body)))});
      const input = await request.json();
      const output = {ok: true, verifiedAt: new Date().toISOString(), verificationMethod: 'x402-facilitator'};
      const settle = await facilitator(env, 'settle', {x402Version: 2, paymentPayload, paymentRequirements: requirement});
      if (!settle.ok || !settle.data?.success) return json(502, {error: 'settlement_failed', details: settle.data});
      const receipt = await makeReceipt(env, {agentId: input.agentId, action: input.action || 'premium-verification', policy: 'x402-v2', input, output, paymentId: settle.data?.transaction || null, payment: settle.data || null});
      return json(200, {ok: true, receipt, paymentResponse: settle.data}, {'PAYMENT-RESPONSE': b64(enc.encode(JSON.stringify(settle.data)))});
    }

    return json(404, {error: 'not_found'});
  }
};
