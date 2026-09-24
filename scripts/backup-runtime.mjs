#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const dataDir = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), 'data'));
const args = new Set(process.argv.slice(2));
const includePrivate = args.has('--include-private-key');
const destinationArg = process.argv.find((v) => v.startsWith('--destination='));
const destination = destinationArg ? path.resolve(destinationArg.slice('--destination='.length)) : path.resolve(process.cwd(), 'backups');

async function exists(p) { try { await fs.access(p); return true; } catch { return false; } }
async function sha256File(p) { const h = crypto.createHash('sha256'); h.update(await fs.readFile(p)); return h.digest('hex'); }
function nowStamp() { return new Date().toISOString().replace(/[:.]/g, '-'); }

if (!(await exists(dataDir))) throw new Error('runtime_data_dir_not_found');
const required = ['ed25519-public.pem'];
for (const name of required) {
  if (!(await exists(path.join(dataDir, name)))) throw new Error(`runtime_file_missing:${name}`);
}

const outDir = path.join(destination, `mcp-proof-backup-${nowStamp()}`);
await fs.mkdir(outDir, { recursive: true, mode: 0o700 });

const manifest = {
  format: 'mcp-proof-runtime-backup-v1',
  createdAt: new Date().toISOString(),
  sourceDataDir: dataDir,
  includesPrivateKey: includePrivate,
  files: {},
  missingOptionalFiles: []
};

const copyIfPresent = async (name, mode = null) => {
  const src = path.join(dataDir, name);
  if (!(await exists(src))) {
    manifest.missingOptionalFiles.push(name);
    return;
  }
  const dst = path.join(outDir, name);
  await fs.copyFile(src, dst);
  if (mode) await fs.chmod(dst, mode);
  manifest.files[name] = { sha256: await sha256File(dst) };
};

await copyIfPresent('receipts.jsonl', 0o600);
await copyIfPresent('a2a-tasks.jsonl', 0o600);
await copyIfPresent('ed25519-public.pem', 0o644);

if (await exists(path.join(dataDir, 'ed25519-private.pem'))) {
  if (includePrivate) {
    const dst = path.join(outDir, 'ed25519-private.pem');
    await fs.copyFile(path.join(dataDir, 'ed25519-private.pem'), dst);
    await fs.chmod(dst, 0o600);
    manifest.files['ed25519-private.pem'] = { sha256: await sha256File(dst), sensitive: true };
  } else {
    manifest.privateKeyPresentButExcluded = true;
  }
}

await fs.writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 });
console.log(JSON.stringify({ ok: true, backupDir: outDir, includesPrivateKey: includePrivate, missingOptionalFiles: manifest.missingOptionalFiles }, null, 2));
