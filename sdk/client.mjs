export class MachineCommerceProofClient {
  constructor(baseUrl = 'http://localhost:4020') {
    this.baseUrl = String(baseUrl).replace(/\/$/, '');
  }
  async request(path, options = {}) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        ...(options.body ? {'content-type': 'application/json'} : {}),
        ...(options.headers || {}),
      },
    });
    const text = await response.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}`);
      error.status = response.status;
      error.body = body;
      throw error;
    }
    return body;
  }
  health() { return this.request('/health'); }
  metadata() { return this.request('/.well-known/agent-proof.json'); }
  publicKey() { return this.request('/v1/public-key'); }
  createProof(payload) { return this.request('/v1/proof', {method: 'POST', body: JSON.stringify(payload)}); }
  verifyReceipt(receipt) { return this.request('/v1/verify', {method: 'POST', body: JSON.stringify({receipt})}); }
  verifyChain() { return this.request('/v1/verify-chain'); }
  stats() { return this.request('/v1/stats'); }
  receipt(runId) { return this.request(`/v1/receipt/${encodeURIComponent(runId)}`); }
  receipts(limit = 50) { return this.request(`/v1/receipts?limit=${encodeURIComponent(limit)}`); }

  async mcpRequest(method, name, params = {}) {
    const payload = {
      jsonrpc: '2.0',
      id: globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      method,
      params: {
        ...(method === 'tools/call' ? { name, arguments: params } : params),
        _meta: {
          'io.modelcontextprotocol/protocolVersion': '2026-07-28',
          'io.modelcontextprotocol/clientInfo': { name: 'machine-commerce-proof-sdk', version: '0.21.1' },
          'io.modelcontextprotocol/clientCapabilities': {},
        },
      },
    };
    const result = await this.request('/mcp', {
      method: 'POST',
      headers: {
        'MCP-Protocol-Version': '2026-07-28',
        'Mcp-Method': method,
        'Mcp-Name': name,
      },
      body: JSON.stringify(payload),
    });
    if (result?.error) {
      const error = new Error(result.error.message || 'MCP error');
      error.code = result.error.code;
      error.body = result;
      throw error;
    }
    return result;
  }
  mcpDiscover() { return this.mcpRequest('server/discover', 'server/discover'); }
  mcpTools() { return this.mcpRequest('tools/list', 'tools/list'); }
  mcpCallTool(name, argumentsObject = {}) { return this.mcpRequest('tools/call', name, argumentsObject); }
}



/** Map a receipt into an A2A 1.0 structured-data Part. */
export function receiptToA2APart(receipt) {
  if (!receipt || typeof receipt !== 'object') throw new TypeError('receipt must be an object');
  return {
    data: { type: 'machine-commerce-proof/receipt', version: '0.4', receipt },
    mediaType: 'application/vnd.machine-commerce-proof+json'
  };
}

/** Extract a receipt from a Machine Commerce Proof A2A structured-data Part. */
export function receiptFromA2APart(part) {
  if (!part || part.mediaType !== 'application/vnd.machine-commerce-proof+json') {
    throw new TypeError('unsupported A2A Part mediaType');
  }
  const data = part.data;
  if (!data || data.type !== 'machine-commerce-proof/receipt' || !data.receipt || typeof data.receipt !== 'object') {
    throw new TypeError('invalid Machine Commerce Proof A2A Part');
  }
  return data.receipt;
}


/** Send a synchronous A2A 1.0 JSON-RPC message to the proof service. */
export async function a2aSendMessage(baseUrl, message) {
  const base = String(baseUrl).replace(/\/$/, '');
  const response = await fetch(`${base}/a2a`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'A2A-Version': '1.0' },
    body: JSON.stringify({ jsonrpc: '2.0', id: crypto.randomUUID(), method: 'SendMessage', params: { message } })
  });
  const body = await response.json();
  if (!response.ok || body?.error) throw new Error(body?.error?.message || `A2A HTTP ${response.status}`);
  return body;
}

/** Fetch a completed A2A task through the JSON-RPC binding. */
export async function a2aGetTask(baseUrl, taskId) {
  const base = String(baseUrl).replace(/\/$/, '');
  const response = await fetch(`${base}/a2a`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'A2A-Version': '1.0' },
    body: JSON.stringify({ jsonrpc: '2.0', id: crypto.randomUUID(), method: 'GetTask', params: { id: taskId } })
  });
  const body = await response.json();
  if (!response.ok || body?.error) throw new Error(body?.error?.message || `A2A HTTP ${response.status}`);
  return body;
}

/** Build the A2A message used to request proof verification. */
export function a2aReceiptVerificationMessage(receipt) {
  return {
    messageId: crypto.randomUUID(),
    role: 'ROLE_USER',
    parts: [receiptToA2APart(receipt)]
  };
}
