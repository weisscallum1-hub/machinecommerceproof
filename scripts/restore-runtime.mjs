#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const sourceArg = process.argv.find((v) => v.startsWith('--source='));
if (!sourceArg) {
  console.error('Usage: npm run restore-check -- --source=/path/to/backup');
  process.exit(2);
}
const source = path.resolve(sourceArg.slice('--source='.length));
const directManifest = path.join(source, 'manifest.json');
async function exists(p) { try { await fs.access(p); return true; } catch { return false; } }
let effectiveSource = source;
let manifestPath = directManifest;
if (!(await exists(manifestPath))) {
  const entries = await fs.readdir(source, { withFileTypes: true });
  const candidates = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const candidate = path.join(source, entry.name, 'manifest.json');
    if (await exists(candidate)) candidates.push({ path: candidate, dir: path.join(source, entry.name), name: entry.name });
  }
  candidates.sort((a, b) => b.name.localeCompare(a.name));
  if (candidates.length !== 1 && candidates.length !== 0) throw new Error('ambiguous_backup_source');
  if (candidates.length === 1) { manifestPath = candidates[0].path; effectiveSource = candidates[0].dir; }
}

async function sha256File(p) { const h = crypto.createHash('sha256'); h.update(await fs.readFile(p)); return h.digest('hex'); }
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
if (manifest.format !== 'mcp-proof-runtime-backup-v1') throw new Error('unsupported_backup_format');

const results = {};
for (const [name, meta] of Object.entries(manifest.files || {})) {
  const p = path.join(effectiveSource, name);
  const digest = await sha256File(p);
  results[name] = { expected: meta.sha256, actual: digest, valid: digest === meta.sha256, sensitive: Boolean(meta.sensitive) };
}
const allValid = Object.values(results).every((v) => v.valid);
console.log(JSON.stringify({ ok: allValid, backupFormat: manifest.format, includesPrivateKey: Boolean(manifest.includesPrivateKey), files: results, missingOptionalFiles: manifest.missingOptionalFiles || [] }, null, 2));
if (!allValid) process.exit(1);
