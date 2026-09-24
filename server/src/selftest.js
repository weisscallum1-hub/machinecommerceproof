import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-proof-'));
const env = { ...process.env, PORT: '4123', DATA_DIR: temp };
const child = spawn(process.execPath, [path.join(serverDir, 'server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function request(url, options) {
  const res = await fetch(url, options);
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: res.status, body, headers: Object.fromEntries(res.headers.entries()) };
}
async function get(url) { return request(url); }
async function post(url, body) {
  return request(url, { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify(body) });
}
async function postMcp(method, name, params) {
  return request('http://127.0.0.1:4123/mcp', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'MCP-Protocol-Version': '2026-07-28',
      'Mcp-Method': method,
      'Mcp-Name': name,
    },
    body: JSON.stringify({
      jsonrpc: '2.0', id: Math.floor(Math.random() * 100000), method,
      params: {
        ...(method === 'tools/call' ? {name, arguments: params || {}} : (params || {})),
        _meta: {
          'io.modelcontextprotocol/protocolVersion': '2026-07-28',
          'io.modelcontextprotocol/clientInfo': {name: 'mcp-proof-selftest', version: '0.1.0'},
          'io.modelcontextprotocol/clientCapabilities': {},
        },
      },
    }),
  });
}

try {
  await sleep(350);
  const health = await get('http://127.0.0.1:4123/health');
  if (health.status !== 200 || !health.body.ok || health.body.version !== '0.21.1') throw new Error('health failed');
  const healthRequest = await request('http://127.0.0.1:4123/health', { headers: { 'x-request-id': 'selftest-req-01' } });
  if (healthRequest.status !== 200 || healthRequest.body.version !== '0.21.1' || healthRequest.headers['x-request-id'] !== 'selftest-req-01') throw new Error('request id health failed');
  if (!health.body.requestId && !health.body.ok) throw new Error('health failed');

  const options = await request('http://127.0.0.1:4123/health', { method: 'OPTIONS' });
  if (options.status !== 204) throw new Error('options failed');

  const mcpDiscover = await postMcp('server/discover', 'server/discover', {});
  if (mcpDiscover.status !== 200 || mcpDiscover.body.result?.resultType !== 'complete' || !mcpDiscover.body.result?.supportedVersions?.includes('2026-07-28')) throw new Error('mcp discover failed');

  const mcpTools = await postMcp('tools/list', 'tools/list', {});
  if (mcpTools.status !== 200 || mcpTools.body.result?.resultType !== 'complete' || mcpTools.body.result?.cacheScope !== 'public' || !Number.isInteger(mcpTools.body.result?.ttlMs)) throw new Error('mcp tools list failed');
  const toolNames = (mcpTools.body.result?.tools || []).map(t => t.name);
  if (toolNames.join(',') !== [...toolNames].sort().join(',')) throw new Error('mcp tools are not deterministic');
  if (!toolNames.includes('create_proof') || !toolNames.includes('verify_receipt')) throw new Error('mcp tool registry incomplete');

  const metadata = await get('http://127.0.0.1:4123/.well-known/agent-proof.json');
  if (metadata.status !== 200 || metadata.body.payments?.x402?.supported !== false || metadata.body.payments?.x402?.adapterReady !== true) throw new Error('metadata semantics failed');
  if (!metadata.body.publicKey?.publicKeySpkiB64 || !metadata.body.publicKey?.publicKeyPem) throw new Error('metadata key encodings missing');

  const malformed = await request('http://127.0.0.1:4123/v1/proof', { method: 'POST', headers: {'content-type':'application/json'}, body: '{' });
  if (malformed.status !== 400 || malformed.body.error !== 'invalid_json') throw new Error('malformed json handling failed');

  const invalidAction = await post('http://127.0.0.1:4123/v1/proof', { action: {bad: true} });
  if (invalidAction.status !== 400 || invalidAction.body.error !== 'action_invalid') throw new Error('action validation failed');

  const created = await post('http://127.0.0.1:4123/v1/proof', {
    agentId: 'selftest-agent', action: 'self-test', policy: 'test-only',
    input: { a: 1 }, output: { ok: true }, paymentId: 'test-payment'
  });
  if (created.status !== 200) throw new Error('proof failed');
  const receipt = created.body.receipt;

  const mcpCreated = await postMcp('tools/call', 'create_proof', {action: 'mcp-self-test', policy: 'test-only', input: {source: 'mcp'}, output: {ok: true}});
  if (mcpCreated.status !== 200 || mcpCreated.body.result?.structuredContent?.ok !== true || !mcpCreated.body.result?.structuredContent?.receipt?.signature) throw new Error('mcp create_proof failed');
  const mcpVerified = await postMcp('tools/call', 'verify_receipt', {receipt: mcpCreated.body.result.structuredContent.receipt});
  if (mcpVerified.status !== 200 || !mcpVerified.body.result?.structuredContent?.verified) throw new Error('mcp verify_receipt failed');

  const listed = await get('http://127.0.0.1:4123/v1/receipts?limit=10');
  if (listed.status !== 200 || listed.body.count !== 2) throw new Error('list failed');

  const fetched = await get(`http://127.0.0.1:4123/v1/receipt/${encodeURIComponent(receipt.runId)}`);
  if (fetched.status !== 200 || fetched.body.receiptHash !== receipt.receiptHash) throw new Error('fetch failed');

  const verified = await post('http://127.0.0.1:4123/v1/verify', { receipt });
  if (verified.status !== 200 || !verified.body.verified || !verified.body.signatureValid || !verified.body.hashValid || verified.body.attestationScope !== 'integrity-only') throw new Error('receipt verification failed');

  const pemOnly = JSON.parse(JSON.stringify(receipt));
  delete pemOnly.signer.publicKeySpkiB64;
  const pemVerified = await post('http://127.0.0.1:4123/v1/verify', { receipt: pemOnly });
  if (!pemVerified.body.verified || !pemVerified.body.signatureValid) throw new Error('pem portability failed');

  const b64Only = JSON.parse(JSON.stringify(receipt));
  delete b64Only.signer.publicKeyPem;
  const b64Verified = await post('http://127.0.0.1:4123/v1/verify', { receipt: b64Only });
  if (!b64Verified.body.verified || !b64Verified.body.signatureValid) throw new Error('spki portability failed');

  const chain = await get('http://127.0.0.1:4123/v1/verify-chain');
  if (chain.status !== 200 || !chain.body.valid || chain.body.count !== 2) throw new Error('chain failed');

  const receiptVerification = await get(`http://127.0.0.1:4123/v1/receipt/${encodeURIComponent(receipt.runId)}/verification`);
  if (receiptVerification.status !== 200 || !receiptVerification.body.verification?.verified) throw new Error('receipt verification endpoint failed');

  const audit = await get('http://127.0.0.1:4123/v1/audit');
  if (audit.status !== 200 || audit.body.operationalState !== 'healthy' || audit.body.receipts?.count !== 2 || audit.body.receipts?.chainValid !== true) throw new Error('audit failed');
  if (audit.body.receipts.latest?.receiptHash !== mcpCreated.body.result.structuredContent.receipt.receiptHash) throw new Error('audit latest receipt failed');
  if (audit.body.privacy?.rawInputsExcluded !== true || audit.body.privacy?.rawOutputsExcluded !== true || audit.body.privacy?.paymentDetailsExcluded !== true) throw new Error('audit privacy failed');

  const tampered = { ...receipt, action: 'tampered' };
  const bad = await post('http://127.0.0.1:4123/v1/verify', { receipt: tampered });
  if (bad.body.verified || bad.body.signatureValid || bad.body.hashValid) throw new Error('tamper detection failed');

  const stats = await get('http://127.0.0.1:4123/v1/stats');
  if (stats.status !== 200 || !stats.body.verifiedChain || stats.body.receipts !== 2) throw new Error('stats failed');

  console.log(JSON.stringify({ ok: true, receiptHash: receipt.receiptHash, publicKeyFingerprint: receipt.signer.keyFingerprint, audit: audit.body, chain: chain.body }, null, 2));
} finally {
  child.kill('SIGTERM');
  fs.rmSync(temp, { recursive: true, force: true });
}
