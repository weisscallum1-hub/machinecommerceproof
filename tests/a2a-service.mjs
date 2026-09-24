import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { receiptToA2APart } from '../sdk/client.mjs';

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'a2a-service-'));
const port = 4139;
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, [path.join(root, 'server/src/server.js')], {
  cwd: root,
  env: { ...process.env, PORT: String(port), DATA_DIR: temp },
  stdio: ['ignore', 'pipe', 'pipe'],
});
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function req(pathname, options = {}) {
  const response = await fetch(`${base}${pathname}`, options);
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: response.status, headers: Object.fromEntries(response.headers), body };
}

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      if ((await req('/health')).status === 200) return;
    } catch {}
    await sleep(100);
  }
  throw new Error('A2A test server did not become ready');
}

async function rpc(payload, version = '1.0') {
  return req('/a2a', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'A2A-Version': version },
    body: JSON.stringify(payload),
  });
}

try {
  await waitForServer();

  const card = await req('/.well-known/agent-card.json');
  assert(card.status === 200, 'Agent Card unavailable');
  assert(card.body.supportedInterfaces?.length === 2, 'Agent Card interface count mismatch');
  assert(card.body.supportedInterfaces[0]?.protocolBinding === 'JSONRPC', 'JSON-RPC interface missing');
  assert(card.body.supportedInterfaces[0]?.protocolVersion === '1.0', 'A2A card protocol version mismatch');
  assert(card.body.supportedInterfaces[1]?.protocolBinding === 'HTTP+JSON', 'HTTP+JSON interface missing');
  assert(card.body.capabilities?.streaming === false, 'unimplemented streaming must not be advertised');
  assert(card.body.capabilities?.pushNotifications === false, 'unimplemented push notifications must not be advertised');

  const created = await req('/v1/proof', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'a2a-service-test', policy: 'test-only', input: { a: 1 }, output: { ok: true } }),
  });
  const receipt = created.body.receipt;
  assert(created.status === 200 && receipt?.signature, 'proof setup failed');

  const contextId = crypto.randomUUID();
  const message = {
    messageId: crypto.randomUUID(),
    contextId,
    role: 'ROLE_USER',
    parts: [receiptToA2APart(receipt)],
  };

  const rpcSend = await rpc({ jsonrpc: '2.0', id: 1, method: 'SendMessage', params: { message } });
  assert(rpcSend.status === 200 && rpcSend.body.jsonrpc === '2.0' && rpcSend.body.id === 1, 'A2A JSON-RPC send failed');
  assert(!rpcSend.body.error, 'valid JSON-RPC request unexpectedly returned an error');
  const task = rpcSend.body.result?.task;
  assert(task?.status?.state === 'TASK_STATE_COMPLETED', 'A2A JSON-RPC task not completed');
  assert(task.contextId === contextId, 'A2A contextId was not preserved');
  assert(task.history?.[0]?.messageId === message.messageId, 'A2A message history was not preserved');
  assert(task.status?.timestamp && !Number.isNaN(Date.parse(task.status.timestamp)), 'A2A status timestamp is invalid');
  const rpcVerification = task.artifacts?.[0]?.parts?.[0]?.data?.verification;
  assert(rpcVerification?.verified === true, 'A2A verification result missing or invalid');

  const got = await rpc({ jsonrpc: '2.0', id: 2, method: 'GetTask', params: { id: task.id } });
  assert(got.body.result?.id === task.id, 'A2A JSON-RPC GetTask failed');
  const zeroHistory = await rpc({ jsonrpc: '2.0', id: 3, method: 'GetTask', params: { id: task.id, historyLength: 0 } });
  assert(Array.isArray(zeroHistory.body.result?.history) && zeroHistory.body.result.history.length === 0, 'A2A historyLength=0 failed');

  const malformed = await rpc({ jsonrpc: '2.0', id: 4 });
  assert(malformed.body.error?.code === -32600 && malformed.body.id === 4, 'invalid JSON-RPC request error mismatch');
  const unknownMethod = await rpc({ jsonrpc: '2.0', id: 5, method: 'CancelTask', params: { id: task.id } });
  assert(unknownMethod.body.error?.code === -32601 && unknownMethod.body.id === 5, 'unsupported operation error mismatch');
  const invalidParams = await rpc({ jsonrpc: '2.0', id: 6, method: 'SendMessage', params: {} });
  assert(invalidParams.body.error?.code === -32602 && invalidParams.body.id === 6, 'invalid SendMessage params error mismatch');
  const missingTaskId = await rpc({ jsonrpc: '2.0', id: 7, method: 'GetTask', params: {} });
  assert(missingTaskId.body.error?.code === -32602, 'missing GetTask id error mismatch');
  const missingTask = await rpc({ jsonrpc: '2.0', id: 8, method: 'GetTask', params: { id: 'not-a-task' } });
  assert(missingTask.body.error?.code === -32001, 'unknown task JSON-RPC error code mismatch');
  assert(missingTask.body.error?.data?.[0]?.reason === 'TASK_NOT_FOUND', 'unknown task JSON-RPC error details missing');

  const unsupportedVersion = await rpc({ jsonrpc: '2.0', id: 9, method: 'SendMessage', params: { message } }, '0.3');
  assert(unsupportedVersion.status === 400, 'unsupported A2A version was not rejected');
  assert(unsupportedVersion.body.error?.code === -32009, 'VersionNotSupported JSON-RPC code mismatch');
  assert(unsupportedVersion.body.error?.data?.[0]?.reason === 'VERSION_NOT_SUPPORTED', 'version error details missing');
  const missingVersion = await req('/a2a', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 10, method: 'SendMessage', params: { message } }),
  });
  assert(missingVersion.status === 400 && missingVersion.body.error?.code === -32009, 'missing A2A version was not rejected consistently');
  const invalidJson = await req('/a2a', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'A2A-Version': '1.0' },
    body: '{invalid-json',
  });
  assert(invalidJson.status === 400 && invalidJson.body.error?.code === -32600, 'malformed JSON error mismatch');

  const unsupportedMessage = await rpc({ jsonrpc: '2.0', id: 11, method: 'SendMessage', params: {
    message: { messageId: crypto.randomUUID(), role: 'ROLE_USER', parts: [{ text: 'unsupported request' }] },
  } });
  assert(unsupportedMessage.body.result?.task?.status?.state === 'TASK_STATE_REJECTED', 'unsupported request was not rejected as a task');

  const rest = await req('/message:send', {
    method: 'POST',
    headers: { 'content-type': 'application/a2a+json', 'A2A-Version': '1.0' },
    body: JSON.stringify({ message }),
  });
  assert(rest.status === 200 && rest.headers['content-type']?.includes('application/a2a+json'), 'A2A HTTP+JSON send failed');
  assert(rest.body.task?.status?.state === 'TASK_STATE_COMPLETED', 'A2A HTTP+JSON task not completed');
  assert(rest.body.task?.artifacts?.[0]?.parts?.[0]?.data?.verification?.verified === rpcVerification.verified, 'HTTP+JSON and JSON-RPC results differ');
  const fetched = await req(`/tasks/${encodeURIComponent(rest.body.task.id)}?historyLength=0`, { headers: { 'A2A-Version': '1.0' } });
  assert(fetched.status === 200 && fetched.body.id === rest.body.task.id, 'A2A HTTP+JSON GetTask failed');
  assert(Array.isArray(fetched.body.history) && fetched.body.history.length === 0, 'HTTP+JSON historyLength=0 failed');

  const missingVersionRest = await req('/message:send', {
    method: 'POST',
    headers: { 'content-type': 'application/a2a+json' },
    body: JSON.stringify({ message }),
  });
  assert(missingVersionRest.status === 400 && missingVersionRest.body.supportedVersions?.includes('1.0'), 'HTTP+JSON version negotiation error mismatch');
  const malformedRest = await req('/message:send', {
    method: 'POST',
    headers: { 'content-type': 'application/a2a+json', 'A2A-Version': '1.0' },
    body: JSON.stringify({ message: { role: 'ROLE_AGENT', parts: [] } }),
  });
  assert(malformedRest.status === 400, 'invalid HTTP+JSON message was accepted');
  const unknownRestTask = await req('/tasks/not-a-task', { headers: { 'A2A-Version': '1.0' } });
  assert(unknownRestTask.status === 404 && unknownRestTask.headers['content-type']?.includes('application/a2a+json'), 'HTTP+JSON task-not-found response mismatch');
  assert(unknownRestTask.body.error?.code === 404 && unknownRestTask.body.error?.status === 'NOT_FOUND', 'HTTP+JSON task-not-found error envelope mismatch');
  assert(unknownRestTask.body.error?.details?.[0]?.reason === 'TASK_NOT_FOUND', 'HTTP+JSON task-not-found details missing');

  console.log(JSON.stringify({
    ok: true,
    agentCard: card.body.name,
    jsonRpcTask: task.id,
    restTask: rest.body.task.id,
    negativeCases: 12,
    transports: ['JSONRPC', 'HTTP+JSON'],
  }, null, 2));
} finally {
  child.kill('SIGTERM');
  fs.rmSync(temp, { recursive: true, force: true });
}
