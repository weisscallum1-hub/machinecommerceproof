const base = (process.env.MCP_BASE_URL || 'http://localhost:4020').replace(/\/$/, '');

const endpoints = [
  ['/health', 'health'],
  ['/.well-known/agent-proof.json', 'agent-proof'],
  ['/.well-known/agent-card.json', 'agent-card'],
  ['/v1/stats', 'stats'],
  ['/v1/audit', 'audit'],
];

let failed = false;
for (const [path, name] of endpoints) {
  try {
    const res = await fetch(`${base}${path}`);
    const body = await res.text();
    if (!res.ok) {
      failed = true;
      console.log(`${name}: FAIL (${res.status})`);
      continue;
    }
    let parsed;
    try { parsed = JSON.parse(body); } catch { parsed = body; }
    console.log(`${name}: OK`);
    if (name === 'health' || name === 'stats') console.log(JSON.stringify(parsed, null, 2));
  } catch (error) {
    failed = true;
    console.log(`${name}: FAIL (${error.message})`);
  }
}

process.exitCode = failed ? 1 : 0;
