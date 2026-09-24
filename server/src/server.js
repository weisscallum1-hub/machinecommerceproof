import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createSnapshot } from './snapshot.js';
import { sha256, stableJson, signJson, verifyJson, loadOrCreateKeyPair, fingerprint, publicKeySpkiB64, publicKeyFromSigner } from './crypto.js';

const PORT = Number(process.env.PORT || 4020);
const VERSION = '0.21.1';
const MCP_PROTOCOL_VERSION = '2026-07-28';
const SCHEMA = 'mcp-receipt-v0.4';
const NODE_ENV = process.env.NODE_ENV || 'development';
const CORS_ORIGIN = process.env.CORS_ORIGIN || (NODE_ENV === 'production' ? '' : '*');
const RATE_LIMIT_ENABLED = process.env.RATE_LIMIT_ENABLED !== 'false';
const RATE_LIMIT_WINDOW_MS = Math.max(1000, Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000));
const RATE_LIMIT_MAX = Math.max(1, Number(process.env.RATE_LIMIT_MAX || 120));
const TRUST_PROXY = process.env.TRUST_PROXY === 'true';
const PROOF_WRITE_TOKEN = process.env.PROOF_WRITE_TOKEN || '';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const rateBuckets = new Map();
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), '..', 'data'));
fs.mkdirSync(DATA_DIR, { recursive: true });
const RECEIPT_PATH = path.join(DATA_DIR, 'receipts.jsonl');
const TASK_PATH = path.join(DATA_DIR, 'a2a-tasks.jsonl');
const KEYS = loadOrCreateKeyPair(DATA_DIR);
const PUBLIC_KEY_PEM = KEYS.publicKey.toString();
const PUBLIC_KEY_FINGERPRINT = fingerprint(PUBLIC_KEY_PEM);
const PUBLIC_KEY_SPKI_B64 = publicKeySpkiB64(PUBLIC_KEY_PEM);

function sliceHistory(history, requested) {
  const list = Array.isArray(history) ? history : [];
  if (requested === 0) return [];
  if (requested == null) return list;
  return list.slice(-requested);
}

function json(res, status, body, headers = {}) {
  const defaults = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()',
    'content-security-policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization,x-request-id,A2A-Version,A2A-Extensions,MCP-Protocol-Version,Mcp-Method,Mcp-Name',
  };
  if (CORS_ORIGIN) defaults['access-control-allow-origin'] = CORS_ORIGIN;
  res.writeHead(status, { ...defaults, ...headers });
  if (status === 204) return res.end();
  res.end(JSON.stringify(body, null, 2));
}

async function body(req) {
  let data = '';
  for await (const chunk of req) {
    data += chunk;
    if (data.length > 512_000) throw new Error('request_too_large');
  }
  if (!data) return {};
  try {
    const parsed = JSON.parse(data);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid_json_object');
    return parsed;
  } catch (err) {
    if (err?.message === 'invalid_json_object') throw err;
    throw new Error('invalid_json');
  }
}

function validateString(value, field, max = 256) {
  if (typeof value !== 'string' || value.trim() === '' || value.length > max) throw new Error(`${field}_invalid`);
  return value;
}

function getReceipts() {
  if (!fs.existsSync(RECEIPT_PATH)) return [];
  return fs.readFileSync(RECEIPT_PATH, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
}

function getTasks() {
  if (!fs.existsSync(TASK_PATH)) return [];
  return fs.readFileSync(TASK_PATH, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
}

function saveTask(task) {
  fs.appendFileSync(TASK_PATH, JSON.stringify(task) + '\n');
  return task;
}

function a2aJson(res, status, body, headers = {}) {
  return json(res, status, body, {
    'access-control-allow-headers': 'content-type,authorization,x-request-id,A2A-Version,A2A-Extensions,MCP-Protocol-Version,Mcp-Method,Mcp-Name',
    ...headers,
  });
}

function requestClientKey(req) {
  if (TRUST_PROXY) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) return forwarded.split(',')[0].trim();
    const cloudflare = req.headers['cf-connecting-ip'];
    if (typeof cloudflare === 'string' && cloudflare.trim()) return cloudflare.trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

function rateLimit(req, res, bucket) {
  if (!RATE_LIMIT_ENABLED) return true;
  const key = `${bucket}:${requestClientKey(req)}`;
  const now = Date.now();
  let entry = rateBuckets.get(key);
  if (!entry || now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) entry = { windowStart: now, count: 0 };
  entry.count += 1;
  rateBuckets.set(key, entry);
  if (rateBuckets.size > 5000) {
    for (const [k, value] of rateBuckets) if (now - value.windowStart >= RATE_LIMIT_WINDOW_MS) rateBuckets.delete(k);
  }
  const remaining = Math.max(0, RATE_LIMIT_MAX - entry.count);
  res.setHeader('x-ratelimit-limit', String(RATE_LIMIT_MAX));
  res.setHeader('x-ratelimit-remaining', String(remaining));
  if (entry.count > RATE_LIMIT_MAX) {
    const retryAfter = Math.max(1, Math.ceil((RATE_LIMIT_WINDOW_MS - (now - entry.windowStart)) / 1000));
    res.setHeader('retry-after', String(retryAfter));
    json(res, 429, { error: 'rate_limit_exceeded', retryAfter });
    return false;
  }
  return true;
}

function bearerAuthorized(req, token) {
  if (!token) return true;
  const header = req.headers.authorization;
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return false;
  const supplied = Buffer.from(header.slice(7));
  const expected = Buffer.from(token);
  return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
}

function requireToken(req, res, token, scope) {
  if (bearerAuthorized(req, token)) return true;
  json(res, 401, { error: 'unauthorized', scope }, { 'www-authenticate': 'Bearer' });
  return false;
}

function a2aCard(origin) {
  return {
    name: 'Machine Commerce Proof Verifier',
    description: 'A narrowly scoped A2A 1.0 service for verifying Machine Commerce Proof receipts and receipt chains.',
    supportedInterfaces: [
      { url: `${origin}/a2a`, protocolBinding: 'JSONRPC', protocolVersion: '1.0' },
      { url: `${origin}/message:send`, protocolBinding: 'HTTP+JSON', protocolVersion: '1.0' }
    ],
    version: VERSION,
    capabilities: { streaming: false, pushNotifications: false, stateTransitionHistory: false },
    defaultInputModes: ['application/vnd.machine-commerce-proof+json', 'application/json', 'text/plain'],
    defaultOutputModes: ['application/vnd.machine-commerce-proof+json', 'application/json', 'text/plain'],
    skills: [
      {
        id: 'verify-receipt',
        name: 'Verify Receipt',
        description: 'Verify integrity, signature and signer fingerprint of a Machine Commerce Proof receipt.',
        tags: ['proof', 'verification', 'integrity'],
        inputModes: ['application/vnd.machine-commerce-proof+json'],
        outputModes: ['application/vnd.machine-commerce-proof+json'],
        examples: ['Verify this Machine Commerce Proof receipt.']
      },
      {
        id: 'verify-chain',
        name: 'Verify Receipt Chain',
        description: 'Validate the integrity and linkage of the service receipt chain.',
        tags: ['proof', 'chain', 'verification'],
        inputModes: ['application/json', 'text/plain'],
        outputModes: ['application/vnd.machine-commerce-proof+json'],
        examples: ['Verify the receipt chain.']
      }
    ]
  };
}

function extractReceiptFromA2AMessage(message) {
  for (const part of Array.isArray(message?.parts) ? message.parts : []) {
    if (part?.data?.type === 'machine-commerce-proof/receipt' && part.data.receipt && typeof part.data.receipt === 'object') return part.data.receipt;
    if (part?.mediaType === 'application/vnd.machine-commerce-proof+json' && part?.data?.receipt && typeof part.data.receipt === 'object') return part.data.receipt;
  }
  return null;
}

function isChainRequest(message) {
  return Array.isArray(message?.parts) && message.parts.some(part => typeof part?.text === 'string' && /verify.*chain|chain.*verify/i.test(part.text));
}

function buildA2ATask(message) {
  const taskId = crypto.randomUUID();
  const contextId = message?.contextId || crypto.randomUUID();
  const now = new Date().toISOString();
  const receipt = extractReceiptFromA2AMessage(message);
  let verification;
  let name;
  if (receipt) {
    verification = verifyReceipt(receipt);
    name = 'Receipt Verification';
  } else if (isChainRequest(message)) {
    verification = validateChain();
    name = 'Receipt Chain Verification';
  } else {
    verification = { supported: false, error: 'expected_receipt_data_or_chain_verification_text' };
    name = 'Unsupported Request';
  }
  const artifact = {
    artifactId: crypto.randomUUID(),
    name,
    description: 'Machine Commerce Proof verification result.',
    parts: [{
      data: { type: 'machine-commerce-proof/receipt-verification', version: '0.4', verification },
      mediaType: 'application/vnd.machine-commerce-proof+json'
    }]
  };
  const task = {
    id: taskId,
    contextId,
    status: { state: verification.supported === false ? 'TASK_STATE_REJECTED' : 'TASK_STATE_COMPLETED', timestamp: now },
    artifacts: [artifact],
    history: message ? [message] : []
  };
  return saveTask(task);
}

function a2aError(id, code, message, data = undefined) {
  const error = { code, message };
  if (data !== undefined) error.data = data;
  return { jsonrpc: '2.0', id: id ?? null, error };
}

function a2aErrorInfo(reason, metadata = {}) {
  return [{
    '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
    reason,
    domain: 'a2a-protocol.org',
    metadata,
  }];
}

function validateA2ARequest(req, contentType = '') {
  const version = req.headers['a2a-version'];
  if (version !== '1.0') return { status: 400, body: { type: 'https://a2a-protocol.org/errors/version-not-supported', title: 'Protocol Version Not Supported', status: 400, detail: 'The requested A2A protocol version is not supported by this service', supportedVersions: ['1.0'] } };
  return null;
}

function a2aJsonRpcResponse(id, result) {
  return { jsonrpc: '2.0', id, result };
}

function handleA2ARpc(request) {
  if (!request || request.jsonrpc !== '2.0' || request.id === undefined || typeof request.method !== 'string') return a2aError(request?.id, -32600, 'Invalid Request');
  if (request.method === 'SendMessage') {
    if (!request.params?.message || request.params.message.role !== 'ROLE_USER' || !Array.isArray(request.params.message.parts)) return a2aError(request.id, -32602, 'message with ROLE_USER and parts is required');
    return a2aJsonRpcResponse(request.id, { task: buildA2ATask(request.params.message) });
  }
  if (request.method === 'GetTask') {
    const id = request.params?.id;
    if (typeof id !== 'string' || !id) return a2aError(request.id, -32602, 'task id is required');
    const task = getTasks().find(t => t.id === id);
    if (!task) return a2aError(request.id, -32001, 'Task not found', a2aErrorInfo('TASK_NOT_FOUND', { taskId: id }));
    const historyLength = Number.isFinite(Number(request.params.historyLength)) ? Math.max(0, Math.floor(Number(request.params.historyLength))) : null;
    return a2aJsonRpcResponse(request.id, { ...task, history: sliceHistory(task.history, historyLength) });
  }
  return a2aError(request.id, -32601, 'Method not found');
}

function cryptographicInput(receipt, removeHash = false) {
  const copy = { ...receipt, signer: receipt.signer ? { ...receipt.signer } : receipt.signer };
  if (removeHash) delete copy.receiptHash;
  delete copy.signature;
  if (copy.signer) {
    delete copy.signer.publicKeyPem;
    delete copy.signer.publicKeySpkiB64;
  }
  return copy;
}

function receiptHashInput(receipt) {
  return cryptographicInput(receipt, true);
}

function signatureInput(receipt) {
  return cryptographicInput(receipt, false);
}

function makeReceipt(payload) {
  const previous = getReceipts().at(-1) ?? null;
  const receipt = {
    schema: SCHEMA,
    runId: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    agentId: payload.agentId == null ? 'demo-agent' : validateString(payload.agentId, 'agentId'),
    action: validateString(payload.action, 'action'),
    policy: payload.policy == null ? 'unspecified' : validateString(payload.policy, 'policy'),
    inputHash: `sha256:${sha256(stableJson(payload.input ?? null))}`,
    outputHash: `sha256:${sha256(stableJson(payload.output ?? null))}`,
    paymentId: payload.paymentId ? String(payload.paymentId) : null,
    payment: payload.payment || null,
    previousReceiptHash: previous?.receiptHash || null,
    provenance: { inputTrust: 'untrusted', attestationScope: 'integrity-only' },
    signer: {
      algorithm: 'Ed25519',
      keyFingerprint: PUBLIC_KEY_FINGERPRINT,
      publicKeyPem: PUBLIC_KEY_PEM,
      publicKeySpkiB64: PUBLIC_KEY_SPKI_B64,
    },
  };
  receipt.receiptHash = `sha256:${sha256(stableJson(receiptHashInput(receipt)))}`;
  receipt.signature = signJson(signatureInput(receipt), KEYS.privateKey);
  fs.appendFileSync(RECEIPT_PATH, JSON.stringify(receipt) + '\n');
  return receipt;
}

function verifyReceipt(receipt) {
  if (!receipt || typeof receipt !== 'object') return { verified: false, error: 'invalid_receipt' };
  let publicKey;
  try { publicKey = publicKeyFromSigner(receipt.signer); } catch { return { verified: false, error: 'missing_public_key' }; }
  const expectedFingerprint = fingerprint(publicKey);
  const signerFingerprintValid = expectedFingerprint === receipt.signer?.keyFingerprint;
  const hashValid = receipt.receiptHash === `sha256:${sha256(stableJson(receiptHashInput(receipt)))}`;
  const signatureValid = signerFingerprintValid && verifyJson(signatureInput(receipt), receipt.signature, publicKey);
  return {
    verified: hashValid && signatureValid,
    hashValid,
    signatureValid,
    signerFingerprintValid,
    keyFingerprint: expectedFingerprint,
    schema: receipt.schema || null,
    attestationScope: receipt.provenance?.attestationScope || 'unspecified',
  };
}

const MCP_TOOLS = [
  {
    name: 'create_proof',
    title: 'Create Proof Receipt',
    description: 'Create a signed, tamper-evident receipt for an agent action.',
    inputSchema: {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: {
        agentId: { type: 'string' },
        action: { type: 'string' },
        policy: { type: 'string' },
        input: {},
        output: {},
        paymentId: { type: ['string', 'null'] },
        payment: {},
      },
      required: ['action'],
      additionalProperties: true,
    },
    outputSchema: {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: { ok: { const: true }, receipt: { type: 'object' } },
      required: ['ok', 'receipt'],
      additionalProperties: false,
    },
  },
  {
    name: 'verify_receipt',
    title: 'Verify Receipt',
    description: 'Independently verify receipt integrity, signature and signer fingerprint.',
    inputSchema: {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: { receipt: { type: 'object' } },
      required: ['receipt'],
      additionalProperties: false,
    },
    outputSchema: {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: {
        verified: { type: 'boolean' },
        hashValid: { type: 'boolean' },
        signatureValid: { type: 'boolean' },
        signerFingerprintValid: { type: 'boolean' },
        keyFingerprint: { type: 'string' },
        attestationScope: { type: 'string' },
        schema: { type: ['string', 'null'] },
      },
      required: ['verified'],
      additionalProperties: true,
    },
  },
  {
    name: 'verify_chain',
    title: 'Verify Receipt Chain',
    description: 'Verify the local append-only receipt chain.',
    inputSchema: {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      additionalProperties: false,
    },
    outputSchema: {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: { valid: { type: 'boolean' }, count: { type: 'integer' }, errors: { type: 'array' } },
      required: ['valid', 'count', 'errors'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_stats',
    title: 'Get Proof Statistics',
    description: 'Return receipt count, chain validity and signer metadata.',
    inputSchema: {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      additionalProperties: false,
    },
    outputSchema: {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: {
        receipts: { type: 'integer' },
        verifiedChain: { type: 'boolean' },
        signerFingerprint: { type: 'string' },
        schema: { type: 'string' },
        mode: { type: 'string' },
      },
      required: ['receipts', 'verifiedChain', 'signerFingerprint', 'schema'],
      additionalProperties: true,
    },
  },
];

function mcpEnvelope(id, result) {
  return {
    jsonrpc: '2.0',
    id,
    result: {
      resultType: 'complete',
      _meta: { 'io.modelcontextprotocol/serverInfo': { name: 'machine-commerce-proof', version: VERSION } },
      ...result,
    },
  };
}

function mcpError(id, code, message, data = undefined) {
  const error = { code, message };
  if (data !== undefined) error.data = data;
  return { jsonrpc: '2.0', id: id ?? null, error };
}

function validateMcpHeaders(req, request) {
  const protocol = req.headers['mcp-protocol-version'];
  const methodHeader = req.headers['mcp-method'];
  const nameHeader = req.headers['mcp-name'];
  const meta = request?.params?._meta;
  if (protocol !== MCP_PROTOCOL_VERSION) return 'unsupported_protocol_version';
  if (!methodHeader || !nameHeader) return 'missing_mcp_headers';
  if (methodHeader !== request?.method) return 'mcp_method_mismatch';
  if (!meta || meta['io.modelcontextprotocol/protocolVersion'] !== MCP_PROTOCOL_VERSION) return 'invalid_request_meta';
  if (!meta['io.modelcontextprotocol/clientInfo'] || !meta['io.modelcontextprotocol/clientCapabilities']) return 'invalid_request_meta';
  if (request.method === 'tools/call' && nameHeader !== request.params?.name) return 'mcp_name_mismatch';
  if (request.method !== 'tools/call' && nameHeader !== request.method) return 'mcp_name_mismatch';
  return null;
}

function mcpToolResult(value) {
  return {
    content: [{ type: 'text', text: JSON.stringify(value) }],
    structuredContent: value,
  };
}

function mcpToolsList() {
  return {
    resultType: 'complete',
    tools: [...MCP_TOOLS].sort((a, b) => a.name.localeCompare(b.name)),
    ttlMs: 3600000,
    cacheScope: 'public',
    _meta: { 'io.modelcontextprotocol/serverInfo': { name: 'machine-commerce-proof', version: VERSION } },
  };
}

async function handleMcp(req, res, request) {
  if (!request || request.jsonrpc !== '2.0' || request.id === undefined || typeof request.method !== 'string') {
    return json(res, 400, mcpError(request?.id, -32600, 'Invalid Request'));
  }
  const headerError = validateMcpHeaders(req, request);
  if (headerError) return json(res, 400, mcpError(request.id, -32600, headerError));

  if (request.method === 'server/discover') {
    return json(res, 200, {
      ...mcpEnvelope(request.id, {
        supportedVersions: [MCP_PROTOCOL_VERSION],
        capabilities: { tools: { listChanged: false }, resources: {}, prompts: {} },
        ttlMs: 3600000,
        cacheScope: 'public',
      }),
    }, { 'cache-control': 'public, max-age=3600' });
  }

  if (request.method === 'tools/list') {
    return json(res, 200, mcpEnvelope(request.id, mcpToolsList()), { 'cache-control': 'public, max-age=3600' });
  }

  if (request.method !== 'tools/call') return json(res, 200, mcpError(request.id, -32601, 'Method not found'));

  const toolName = request.params?.name;
  const args = request.params?.arguments && typeof request.params.arguments === 'object' ? request.params.arguments : {};
  let value;
  try {
    switch (toolName) {
      case 'create_proof':
        if (!bearerAuthorized(req, PROOF_WRITE_TOKEN)) return json(res, 401, mcpError(request.id, -32001, 'proof write authorization required'));
        if (!args.action) return json(res, 200, mcpError(request.id, -32602, 'action is required'));
        value = { ok: true, receipt: makeReceipt(args) };
        break;
      case 'verify_receipt':
        if (!args.receipt || typeof args.receipt !== 'object') return json(res, 200, mcpError(request.id, -32602, 'receipt object is required'));
        value = verifyReceipt(args.receipt);
        break;
      case 'verify_chain':
        value = validateChain();
        break;
      case 'get_stats': {
        const receipts = getReceipts();
        value = { receipts: receipts.length, verifiedChain: validateChain().valid, signerFingerprint: PUBLIC_KEY_FINGERPRINT, schema: SCHEMA, mode: 'local-prototype' };
        break;
      }
      default:
        return json(res, 200, mcpError(request.id, -32602, `Unknown tool: ${toolName}`));
    }
  } catch (err) {
    return json(res, 200, mcpError(request.id, -32603, 'Internal error', { message: err instanceof Error ? err.message : String(err) }));
  }
  return json(res, 200, mcpEnvelope(request.id, mcpToolResult(value)));
}

function validateChain() {
  const receipts = getReceipts();
  let previousHash = null;
  const errors = [];
  for (let i = 0; i < receipts.length; i += 1) {
    const r = receipts[i];
    const verification = verifyReceipt(r);
    if (!verification.verified) errors.push({ index: i, runId: r.runId, error: 'receipt_invalid', details: verification });
    if (r.previousReceiptHash !== previousHash) errors.push({ index: i, runId: r.runId, error: 'chain_link_mismatch' });
    previousHash = r.receiptHash;
  }
  return { valid: errors.length === 0, count: receipts.length, errors };
}

function buildAuditSnapshot() {
  const receipts = getReceipts();
  const chain = validateChain();
  const latest = receipts.at(-1) ?? null;
  const publicKeyMtime = fs.existsSync(path.join(DATA_DIR, 'ed25519-public.pem'))
    ? fs.statSync(path.join(DATA_DIR, 'ed25519-public.pem')).mtime.toISOString()
    : null;
  return {
    service: 'machine-commerce-proof',
    version: VERSION,
    schema: SCHEMA,
    generatedAt: new Date().toISOString(),
    operationalState: chain.valid ? 'healthy' : 'degraded',
    attestation: { scope: 'integrity-only', inputTrust: 'untrusted' },
    receipts: {
      count: receipts.length,
      chainValid: chain.valid,
      chainErrorCount: chain.errors.length,
      latest: latest ? {
        runId: latest.runId,
        createdAt: latest.createdAt,
        agentId: latest.agentId,
        action: latest.action,
        receiptHash: latest.receiptHash,
        previousReceiptHash: latest.previousReceiptHash,
      } : null,
    },
    signer: {
      algorithm: 'Ed25519',
      fingerprint: PUBLIC_KEY_FINGERPRINT,
      publicKeyCreatedAt: publicKeyMtime,
    },
    protocols: {
      mcp: { version: MCP_PROTOCOL_VERSION, status: 'implemented-minimal-stateless' },
      a2a: { version: '1.0', status: 'implemented-minimal-sync' },
      x402: { version: '2', status: 'adapter-ready-disabled-by-default' },
      erc8004: { status: 'mapping-only' },
    },
    privacy: {
      latestReceiptPayloadExcluded: true,
      paymentDetailsExcluded: true,
      rawInputsExcluded: true,
      rawOutputsExcluded: true,
    },
  };
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const inboundRequestId = req.headers['x-request-id'];
    const requestId = typeof inboundRequestId === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(inboundRequestId)
      ? inboundRequestId
      : crypto.randomUUID();
    res.setHeader('x-request-id', requestId);

    if (req.method === 'OPTIONS') return json(res, 204, null);

    const isWriteRoute = req.method === 'POST' && (
      url.pathname === '/api/snapshot' ||
      url.pathname === '/v1/proof' ||
      url.pathname === '/v1/verify' ||
      url.pathname === '/mcp' ||
      url.pathname === '/a2a' ||
      url.pathname === '/message:send'
    );
    if (isWriteRoute && !rateLimit(req, res, url.pathname)) return;

    if (req.method === 'POST' && url.pathname === '/api/snapshot') {
      try {
        const result = await createSnapshot(await body(req));
        return json(res, 200, result, { 'cache-control': 'no-store' });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Snapshot unavailable.';
        return json(res, 400, { error: message }, { 'cache-control': 'no-store' });
      }
    }

    if (req.method === 'GET' && ['/', '/index.html', '/llms.txt', '/robots.txt', '/audit.html', '/verify.html'].includes(url.pathname)) {
      const name = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      const file = path.resolve(path.join(path.dirname(fileURLToPath(import.meta.url)), '../../web', name));
      const content = fs.readFileSync(file);
      const type = name.endsWith('.html') ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8';
      res.writeHead(200, { 'content-type': type, 'cache-control': name === 'index.html' ? 'no-cache' : 'public, max-age=3600' });
      return res.end(content);
    }

    if (req.method === 'GET' && url.pathname === '/.well-known/agent-card.json') {
      return json(res, 200, a2aCard(`${url.protocol}//${url.host}`), { 'cache-control': 'public, max-age=3600' });
    }

    if ((req.method === 'POST' && url.pathname === '/a2a') || (req.method === 'POST' && url.pathname === '/message:send')) {
      const versionError = validateA2ARequest(req, req.headers['content-type'] || '');
      if (versionError) {
        if (url.pathname === '/message:send') return a2aJson(res, versionError.status, versionError.body, { 'content-type': 'application/problem+json' });
        return a2aJson(res, versionError.status, a2aError(null, -32009, versionError.body.detail, a2aErrorInfo('VERSION_NOT_SUPPORTED', { supportedVersions: ['1.0'] })));
      }
      let payload;
      try { payload = await body(req); } catch (err) {
        if (url.pathname === '/message:send') return a2aJson(res, 400, { error: 'invalid_json' }, { 'content-type': 'application/problem+json' });
        return a2aJson(res, 400, a2aError(null, -32600, err instanceof Error ? err.message : 'invalid_json'));
      }
      if (url.pathname === '/a2a') return a2aJson(res, 200, handleA2ARpc(payload), { 'cache-control': 'no-store' });
      if (!payload?.message || payload.message.role !== 'ROLE_USER' || !Array.isArray(payload.message.parts)) return a2aJson(res, 400, { error: 'message with ROLE_USER and parts is required' }, { 'content-type': 'application/problem+json' });
      return a2aJson(res, 200, { task: buildA2ATask(payload.message) }, { 'content-type': 'application/a2a+json', 'cache-control': 'no-store' });
    }

    if (req.method === 'GET' && url.pathname.startsWith('/tasks/')) {
      if (!requireToken(req, res, ADMIN_TOKEN, 'a2a-task-read')) return;
      const versionError = validateA2ARequest(req);
      if (versionError) return a2aJson(res, versionError.status, versionError.body, { 'content-type': 'application/problem+json' });
      const taskId = decodeURIComponent(url.pathname.slice('/tasks/'.length));
      const task = getTasks().find(t => t.id === taskId);
      if (!task) return a2aJson(res, 404, {
        error: {
          code: 404,
          status: 'NOT_FOUND',
          message: 'The specified task ID does not exist or is not accessible',
          details: a2aErrorInfo('TASK_NOT_FOUND', { taskId, timestamp: new Date().toISOString() }),
        },
      }, { 'content-type': 'application/a2a+json' });
      const rawHistoryLength = url.searchParams.get('historyLength');
      const historyLength = rawHistoryLength != null && Number.isFinite(Number(rawHistoryLength)) ? Math.max(0, Math.floor(Number(rawHistoryLength))) : null;
      return a2aJson(res, 200, { ...task, history: sliceHistory(task.history, historyLength) }, { 'content-type': 'application/a2a+json', 'cache-control': 'no-store' });
    }

    if (req.method === 'POST' && url.pathname === '/mcp') {
      let payload;
      try { payload = await body(req); } catch (err) {
        return json(res, 400, mcpError(null, -32600, err instanceof Error ? err.message : 'invalid_json'));
      }
      return handleMcp(req, res, payload);
    }

    if (req.method === 'GET' && url.pathname === '/health') {
      return json(res, 200, { ok: true, service: 'machine-commerce-proof', version: VERSION, time: new Date().toISOString(), security: { production: NODE_ENV === 'production', corsConfigured: Boolean(CORS_ORIGIN), proofWriteAuthConfigured: Boolean(PROOF_WRITE_TOKEN), adminAuthConfigured: Boolean(ADMIN_TOKEN), rateLimitEnabled: RATE_LIMIT_ENABLED } });
    }

    if (req.method === 'GET' && url.pathname === '/.well-known/agent-proof.json') {
      return json(res, 200, {
        type: 'machine-commerce-proof-service',
        version: VERSION,
        capabilities: ['signed-receipts', 'independent-verification', 'chain-verification', 'payment-correlation'],
        receiptSchema: SCHEMA,
        payments: { x402: { supported: false, adapterReady: true }, preferredSettlement: 'USDC' },
        attestation: { scope: 'integrity-only', inputTrust: 'untrusted' },
        identity: { erc8004Compatible: true },
        role: 'verification-service',
        execution: { arbitraryAgentActions: false, proofGeneration: true, proofVerification: true },
        transports: ['https-json', 'mcp-adapter', 'a2a-jsonrpc', 'a2a-http-json'],
        protocols: {
          mcp: { version: MCP_PROTOCOL_VERSION, status: 'implemented-minimal-stateless' },
          x402: { version: '2', status: 'adapter-ready-disabled-by-default' },
          a2a: { version: '1.0', status: 'implemented-minimal-sync', agentCardPublished: true, agentCardPath: '/.well-known/agent-card.json' },
          erc8004: { status: 'mapping-only', implementationClaim: false }
        },
        publicKey: { algorithm: 'Ed25519', fingerprint: PUBLIC_KEY_FINGERPRINT, publicKeyPem: PUBLIC_KEY_PEM, publicKeySpkiB64: PUBLIC_KEY_SPKI_B64 },
      });
    }

    if (req.method === 'GET' && url.pathname === '/v1/public-key') {
      return json(res, 200, { algorithm: 'Ed25519', fingerprint: PUBLIC_KEY_FINGERPRINT, publicKeyPem: PUBLIC_KEY_PEM });
    }

    if (req.method === 'GET' && url.pathname === '/v1/receipts') {
      if (!requireToken(req, res, ADMIN_TOKEN, 'receipt-read')) return;
      const receipts = getReceipts();
      const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 50), 1), 200);
      return json(res, 200, { count: receipts.length, receipts: receipts.slice(-limit) });
    }

    if (req.method === 'GET' && url.pathname.startsWith('/v1/receipt/') && url.pathname.endsWith('/verification')) {
      if (!requireToken(req, res, ADMIN_TOKEN, 'receipt-read')) return;
      const base = '/v1/receipt/';
      const runId = decodeURIComponent(url.pathname.slice(base.length, -'/verification'.length));
      const receipt = getReceipts().find(r => r.runId === runId);
      if (!receipt) return json(res, 404, { error: 'receipt_not_found' });
      return json(res, 200, { runId, receiptHash: receipt.receiptHash, verification: verifyReceipt(receipt) });
    }

    if (req.method === 'GET' && url.pathname.startsWith('/v1/receipt/')) {
      if (!requireToken(req, res, ADMIN_TOKEN, 'receipt-read')) return;
      const runId = decodeURIComponent(url.pathname.slice('/v1/receipt/'.length));
      const receipt = getReceipts().find(r => r.runId === runId);
      if (!receipt) return json(res, 404, { error: 'receipt_not_found' });
      return json(res, 200, receipt);
    }

    if (req.method === 'POST' && url.pathname === '/v1/proof') {
      if (!requireToken(req, res, PROOF_WRITE_TOKEN, 'proof-write')) return;
      let payload;
      try { payload = await body(req); } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message === 'request_too_large') return json(res, 413, { error: 'request_too_large' });
        return json(res, 400, { error: message === 'invalid_json_object' ? 'json_object_required' : 'invalid_json' });
      }
      if (!payload.action) return json(res, 400, { error: 'action is required' });
      const receipt = makeReceipt(payload);
      return json(res, 200, { ok: true, receipt });
    }

    if (req.method === 'POST' && url.pathname === '/v1/verify') {
      let payload;
      try { payload = await body(req); } catch (err) {
        return json(res, 400, { error: err instanceof Error && err.message === 'request_too_large' ? 'request_too_large' : 'invalid_json' });
      }
      const receipt = payload.receipt;
      if (!receipt || typeof receipt !== 'object') return json(res, 400, { error: 'receipt object is required' });
      return json(res, 200, verifyReceipt(receipt));
    }

    if (req.method === 'GET' && url.pathname === '/v1/verify-chain') {
      if (!requireToken(req, res, ADMIN_TOKEN, 'chain-read')) return;
      return json(res, 200, validateChain());
    }

    if (req.method === 'GET' && url.pathname === '/v1/audit') {
      return json(res, 200, buildAuditSnapshot(), { 'cache-control': 'no-store' });
    }

    if (req.method === 'GET' && url.pathname === '/v1/stats') {
      const receipts = getReceipts();
      return json(res, 200, {
        receipts: receipts.length,
        verifiedChain: validateChain().valid,
        signerFingerprint: PUBLIC_KEY_FINGERPRINT,
        schema: SCHEMA,
        mode: 'local-prototype',
      });
    }

    return json(res, 404, { error: 'not_found' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.endsWith('_invalid') ? 400 : 500;
    return json(res, status, { error: status === 400 ? message : 'server_error' });
  }
});

server.listen(PORT, () => console.log(`Machine Commerce Proof v${VERSION} listening on http://localhost:${PORT}`));
