#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const rootPkg = JSON.parse(read('package.json'));
const serverPkg = JSON.parse(read('server/package.json'));
const manifest = JSON.parse(read('config/manifest.json'));
const openapi = read('specs/openapi.yaml');
const readme = read('README.md');
const activeFiles = ['package.json','scripts/backup-runtime.mjs','scripts/restore-runtime.mjs','scripts/recovery-selftest.mjs','server/package.json','config/manifest.json','config/protocols.json','cloudflare-worker/src/index.js','sdk/client.mjs','sdk/client.d.ts','server/src/server.js','server/src/selftest.js','tests/protocol-conformance.mjs','web/index.html','web/audit.html','scripts/audit.mjs','specs/openapi.yaml','tests/security-hardening.mjs','scripts/generate-secrets.mjs','.env.example'];

assert(rootPkg.version === serverPkg.version, `package version mismatch: ${rootPkg.version} != ${serverPkg.version}`);
assert(manifest.version === rootPkg.version, `manifest version mismatch: ${manifest.version} != ${rootPkg.version}`);
assert(openapi.includes(`version: ${rootPkg.version}`), `OpenAPI version does not contain ${rootPkg.version}`);
assert(readme.startsWith(`# Machine Commerce Proof — v${rootPkg.version}`), 'README version header mismatch');
assert(read('cloudflare-worker/src/index.js').includes(`const VERSION = '${rootPkg.version}';`), 'Worker version mismatch');
assert(read('web/index.html').includes(`v${rootPkg.version}`), 'web demo version mismatch');
assert((readme.match(/```/g) || []).length % 2 === 0, 'README has unmatched code fences');
assert(!readme.includes('/scan?url='), 'README references removed /scan demo');
const legacyVersions = ['0.21.0','0.20.1','0.14.0','0.13.0','0.12.0','0.11.0','0.10.0'];
const staleHits = [];
for (const file of activeFiles) { const body = read(file); for (const version of legacyVersions) if (body.includes(version)) staleHits.push(`${file}:${version}`); }
assert(staleHits.length === 0, `active files contain stale versions: ${staleHits.join(', ')}`);
assert(!readme.includes('deployment template and structured-data receipt mapping. It does not claim full A2A server conformance'), 'README has stale A2A template claim');
assert(read('.env.example').includes('PROOF_WRITE_TOKEN='), 'environment template missing proof write token');
assert(read('.env.example').includes('ADMIN_TOKEN='), 'environment template missing admin token');
assert(readme.includes('A2A support is a **narrow synchronous 1.0 service profile**'), 'README A2A status missing');
assert(read('server/src/server.js').includes("role: 'verification-service'"), 'A2A verifier role metadata missing');
assert(read('server/src/server.js').includes("url.pathname === '/v1/audit'"), 'audit endpoint missing');
assert(read('web/audit.html').includes('Operational audit'), 'audit dashboard missing');
assert(read('scripts/restore-runtime.mjs').includes('ambiguous_backup_source'), 'restore ambiguity guard missing');
assert(read('scripts/restore-runtime.mjs').includes('effectiveSource'), 'restore parent-directory support missing');
assert(read('server/src/server.js').includes('RATE_LIMIT_MAX'), 'rate limit configuration missing');
assert(read('server/src/server.js').includes('PROOF_WRITE_TOKEN'), 'proof write authorization missing');
assert(read('server/src/server.js').includes('ADMIN_TOKEN'), 'admin authorization missing');

for (const file of ['config/manifest.json', 'config/protocols.json', 'config/thresholds.json', 'schemas/receipt.schema.json', 'examples/a2a-agent-card.json']) JSON.parse(read(file));

const forbidden = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
    if (['.git','node_modules','.wrangler'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(full); continue; }
    if (/\.(pem|key|pyc)$/.test(entry.name) || entry.name === '.env' || (entry.name.startsWith('.env.') && entry.name !== '.env.example')) forbidden.push(path.relative(root, full));
  }
}
walk(root);
assert(forbidden.length === 0, `generated/secret files present: ${forbidden.join(', ')}`);

execFileSync(process.execPath, ['scripts/verify-receipt.mjs', 'examples/receipt.json'], {cwd: root, stdio: 'pipe'});
console.log(JSON.stringify({ok:true, version:rootPkg.version, exampleReceiptVerified:true}, null, 2));
