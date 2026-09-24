#!/usr/bin/env node
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-recovery-'));
const backupDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-backup-'));
const env = { ...process.env, PORT: '4231', DATA_DIR: dataDir };
const child = spawn(process.execPath, [path.join(root, 'server/src/server.js')], { cwd: root, env, stdio: 'ignore' });
try {
  let ready = false;
  for (let i = 0; i < 40; i += 1) {
    try { const r = await fetch('http://127.0.0.1:4231/health'); if (r.ok) { ready = true; break; } } catch {}
    await sleep(100);
  }
  if (!ready) throw new Error('server_not_ready');
  const created = await fetch('http://127.0.0.1:4231/v1/proof', {
    method:'POST', headers:{'content-type':'application/json'},
    body: JSON.stringify({agentId:'recovery-test',action:'backup-test',policy:'test-only',input:{a:1},output:{ok:true}})
  });
  if (!created.ok) throw new Error('receipt_creation_failed');
  const receipt = (await created.json()).receipt;
  const destination = path.join(backupDir, 'backup');
  execFileSync(process.execPath, ['scripts/backup-runtime.mjs', `--destination=${destination}`], { cwd: root, env: { ...process.env, DATA_DIR: dataDir }, stdio:'pipe' });
  const entries = await fs.readdir(destination, {withFileTypes:true});
  const backupName = entries.find(e => e.isDirectory())?.name;
  if (!backupName) throw new Error('backup_directory_missing');
  const source = path.join(destination, backupName);
  const checked = execFileSync(process.execPath, ['scripts/restore-runtime.mjs', `--source=${source}`], { cwd: root, encoding:'utf8' });
  const report = JSON.parse(checked);
  if (!report.ok || !report.files['receipts.jsonl']?.valid || !report.files['ed25519-public.pem']?.valid) throw new Error('restore_validation_failed');
  const files = await fs.readdir(source);
  if (files.includes('ed25519-private.pem')) throw new Error('private_key_leaked_to_default_backup');
  if (JSON.stringify(receipt).includes('privateKey')) throw new Error('receipt_contains_private_key_marker');
  console.log(JSON.stringify({ok:true, receiptRunId:receipt.runId, backupDir:source, privateKeyExcluded:true}, null, 2));
} finally {
  child.kill('SIGTERM');
  await fs.rm(dataDir, {recursive:true, force:true});
  await fs.rm(backupDir, {recursive:true, force:true});
}
