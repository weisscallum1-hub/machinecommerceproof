const base = (process.env.MCP_BASE_URL || 'http://localhost:4020').replace(/\/$/, '');
const res = await fetch(`${base}/v1/audit`, { headers: { accept: 'application/json' } });
const text = await res.text();
if (!res.ok) {
  console.error(`audit: FAIL (${res.status})`);
  console.error(text);
  process.exit(1);
}
let body;
try { body = JSON.parse(text); } catch {
  console.error('audit: FAIL (invalid JSON)');
  process.exit(1);
}
console.log(JSON.stringify(body, null, 2));
process.exitCode = body.operationalState === 'healthy' && body.receipts.chainValid ? 0 : 1;
