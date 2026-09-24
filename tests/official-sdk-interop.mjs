import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-official-sdk-'));
const port = 4157;
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, [path.join(root, 'server/src/server.js')], {
  cwd: root,
  env: { ...process.env, PORT: String(port), DATA_DIR: temp },
  stdio: ['ignore', 'pipe', 'pipe']
});

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForServer() {
  for (let i = 0; i < 30; i++) {
    try {
      const response = await fetch(`${base}/health`);
      if (response.ok) return;
    } catch {}
    await sleep(100);
  }
  throw new Error('server did not become ready');
}

try {
  const { ClientFactory } = await import('@a2a-js/sdk/client');
  const { SendMessageRequest, TaskState } = await import('@a2a-js/sdk');
  const {
    CallToolResultSchema,
    ListToolsResultSchema,
    JSONRPCMessageSchema
  } = await import('@modelcontextprotocol/core');

  await waitForServer();

  const proof = await fetch(`${base}/v1/proof`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      action: 'official-sdk-interop',
      policy: 'test-only',
      input: { source: 'official-sdk-interop' },
      output: { ok: true }
    })
  }).then((r) => r.json());
  assert(proof.receipt?.signature, 'fixture receipt missing');

  const factory = new ClientFactory();
  const client = await factory.createFromUrl(base);
  const request = SendMessageRequest.fromJSON({
    message: {
      messageId: crypto.randomUUID(),
      role: 'ROLE_USER',
      parts: [{
        data: {
          type: 'machine-commerce-proof/receipt',
          version: '0.4',
          receipt: proof.receipt
        },
        mediaType: 'application/vnd.machine-commerce-proof+json'
      }]
    }
  });
  const result = await client.sendMessage(request);
  assert(result && result.status?.state === TaskState.TASK_STATE_COMPLETED, 'official A2A SDK did not receive a completed task');
  assert(result.artifacts?.[0]?.parts?.[0]?.content?.value?.verification?.verified === true, 'official A2A SDK could not read verification artifact');
  const listResponse = await fetch(`${base}/mcp`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'MCP-Protocol-Version': '2026-07-28',
      'Mcp-Method': 'tools/list',
      'Mcp-Name': 'tools/list'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {
        _meta: {
          'io.modelcontextprotocol/protocolVersion': '2026-07-28',
          'io.modelcontextprotocol/clientInfo': { name: 'official-sdk-interop', version: '0.1.0' },
          'io.modelcontextprotocol/clientCapabilities': {}
        }
      }
    })
  }).then((r) => r.json());
  JSONRPCMessageSchema.parse(listResponse);
  ListToolsResultSchema.parse(listResponse.result);

  const callResponse = await fetch(`${base}/mcp`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'MCP-Protocol-Version': '2026-07-28',
      'Mcp-Method': 'tools/call',
      'Mcp-Name': 'verify_receipt'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'verify_receipt',
        arguments: { receipt: proof.receipt },
        _meta: {
          'io.modelcontextprotocol/protocolVersion': '2026-07-28',
          'io.modelcontextprotocol/clientInfo': { name: 'official-sdk-interop', version: '0.1.0' },
          'io.modelcontextprotocol/clientCapabilities': {}
        }
      }
    })
  }).then((r) => r.json());
  JSONRPCMessageSchema.parse(callResponse);
  CallToolResultSchema.parse(callResponse.result);

  console.log(JSON.stringify({ ok: true, a2aOfficialSdk: true, mcpOfficialSchemas: true }, null, 2));
} finally {
  child.kill('SIGTERM');
  fs.rmSync(temp, { recursive: true, force: true });
}
