#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const base = (process.env.MCP_BASE_URL || 'http://localhost:4020').replace(/\/$/, '');
const checks = [];

function check(name, ok, detail='') {
  checks.push({name, ok: Boolean(ok), detail});
}

try {
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  check('Node.js >= 22', nodeMajor >= 22, process.versions.node);
} catch (e) { check('Node.js', false, e.message); }

for (const [file, name] of [
  ['package.json', 'root package'],
  ['server/package.json', 'server package'],
  ['config/manifest.json', 'manifest'],
  ['specs/openapi.yaml', 'OpenAPI'],
  ['schemas/receipt.schema.json', 'receipt schema'],
]) {
  try { fs.accessSync(path.join(root, file), fs.constants.R_OK); check(name, true); }
  catch (e) { check(name, false, e.message); }
}

try {
  const rootPkg = JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(root,'config/manifest.json'),'utf8'));
  check('version consistency', rootPkg.version === manifest.version, `${rootPkg.version} / ${manifest.version}`);
} catch (e) { check('version consistency', false, e.message); }

try {
  const res = await fetch(`${base}/health`);
  check('service reachable', res.ok, `${res.status} ${base}/health`);
  if (res.ok) {
    const body = await res.json();
    check('service reports healthy', body.status === 'ok' || body.ok === true || body.healthy === true, JSON.stringify(body));
  }
} catch (e) {
  check('service reachable', false, `${base}: ${e.message}`);
}

try {
  const res = await fetch(`${base}/.well-known/agent-proof.json`);
  check('agent-proof discovery', res.ok, `${res.status}`);
} catch (e) { check('agent-proof discovery', false, e.message); }

try {
  const res = await fetch(`${base}/.well-known/agent-card.json`);
  check('A2A Agent Card', res.ok, `${res.status}`);
} catch (e) { check('A2A Agent Card', false, e.message); }

try {
  const res = await fetch(`${base}/v1/audit`);
  check('audit endpoint', res.ok, `${res.status}`);
} catch (e) { check('audit endpoint', false, e.message); }

try {
  execFileSync(process.execPath, ['scripts/verify-receipt.mjs', 'examples/receipt.json'], {cwd: root, stdio:'pipe'});
  check('example receipt', true);
} catch (e) { check('example receipt', false, e.stderr?.toString() || e.message); }

const failed = checks.filter(c => !c.ok);
console.log(JSON.stringify({ok: failed.length === 0, base, checks}, null, 2));
process.exitCode = failed.length ? 1 : 0;
