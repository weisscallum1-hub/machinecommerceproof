import { MachineCommerceProofClient } from '../sdk/client.mjs';

const client = new MachineCommerceProofClient(process.env.MCP_PROOF_URL || 'http://localhost:4020');
const created = await client.createProof({
  agentId: 'sdk-example-agent',
  action: 'example-paid-service-call',
  policy: 'demo-only',
  input: {resource: 'example'},
  output: {ok: true},
  paymentId: 'demo-payment',
});
const verification = await client.verifyReceipt(created.receipt);
const chain = await client.verifyChain();
console.log(JSON.stringify({
  receiptHash: created.receipt.receiptHash,
  verified: verification.verified,
  chainValid: chain.valid,
}, null, 2));
