import assert from 'node:assert/strict';
import { createSnapshot } from '../server/src/snapshot.js';

for (const input of [
  { url: 'https://localhost', consent: true },
  { url: 'http://127.0.0.1', consent: true },
  { url: 'file:///etc/passwd', consent: true },
  { url: 'https://example.com:8443', consent: true },
  { url: 'https://example.com', consent: false },
  { url: 'not a url', consent: true }
]) {
  await assert.rejects(() => createSnapshot(input));
}
console.log('AgentReady snapshot input and safety tests passed.');
