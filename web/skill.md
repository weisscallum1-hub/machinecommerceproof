# Machine Commerce Proof

Purpose: verify machine-executed actions and correlate them with payment evidence.

Endpoints:
- GET /.well-known/agent-proof.json
- POST /v1/proof
- POST /v1/verify
- GET /v1/verify-chain
- GET /v1/stats

Receipts use Ed25519 signatures and hash chaining in prototype mode.
Payment correlation is metadata-only until a production x402 adapter is configured.
