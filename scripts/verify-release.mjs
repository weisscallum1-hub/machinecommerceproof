#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const run = (file,args=[]) => execFileSync(process.execPath,[file,...args],{cwd:root,stdio:'inherit',env:{...process.env,DATA_DIR:fs.mkdtempSync(path.join(os.tmpdir(),'mcp-verify-release-'))}});
const forbidden=[];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(['.git','node_modules','.wrangler'].includes(e.name)) continue; const f=path.join(dir,e.name); if(e.isDirectory()) walk(f); else if(/\.(pem|key|pyc)$/.test(e.name)||e.name==='.env'||(e.name.startsWith('.env.') && e.name!=='.env.example')) forbidden.push(path.relative(root,f));}}
walk(root);
if(forbidden.length) throw new Error(`forbidden files present: ${forbidden.join(', ')}`);
run('scripts/release-check.mjs');
run('tests/protocol-conformance.mjs');
run('tests/a2a-interop.mjs');
run('tests/a2a-service.mjs');
run('scripts/recovery-selftest.mjs');
run('tests/security-hardening.mjs');
console.log(JSON.stringify({ok:true,freshCloneVerification:true,recoveryVerification:true},null,2));
