#!/usr/bin/env node
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const minNode = 22;
const major = Number(process.versions.node.split('.')[0]);
const problems = [];
if (major < minNode) problems.push(`Node.js ${minNode}+ required; found ${process.versions.node}`);

for (const command of ['npm']) {
  try { execFileSync(command, ['--version'], {stdio:'pipe'}); }
  catch { problems.push(`${command} is required`); }
}

for (const file of ['package.json','server/package.json','README.md','scripts/run-demo.sh']) {
  if (!fs.existsSync(file)) problems.push(`missing ${file}`);
}

console.log(JSON.stringify({ok: problems.length === 0, node: process.versions.node, problems}, null, 2));
process.exitCode = problems.length ? 1 : 0;
