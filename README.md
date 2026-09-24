# Machine Commerce Proof — v0.21.1

Machine Commerce Proof is an open prototype for **tamper-evident evidence of autonomous software actions**. It records an action, policy, input/output hashes, optional payment metadata, signer identity and chain position in a portable receipt.

## What this project is

- Ed25519-signed receipts with embedded public-key material.
- SHA-256 canonical hashes and hash-linked chains.
- Independent verification from the receipt alone.
- Explicit integrity-only attestation semantics; a valid signature does not prove that an external-world claim is true.
- A small HTTP API suitable for automated callers.
- A tiny JavaScript SDK in `sdk/client.mjs`.
- A readiness scanner for public agent/service metadata.
- Protocol adapters for MCP 2026-07-28 and x402, plus a narrow synchronous A2A 1.0 service profile in the Node reference server; full A2A feature coverage is intentionally not claimed.
- Draft-only ecosystem/research agents and deterministic CI.
- Cloudflare Workers/D1 deployment scaffolding.

## What this project is not

It is not a wallet, exchange, custody system, trading bot, investment product, or token-sale system. The token contract under `contracts/` is intentionally frozen as a non-deployed prototype; the software works without it.

## Run locally

```bash
npm test
npm start
```

The server listens on `http://localhost:4020`. The prototype uses explicit integrity-only attestation: a valid receipt proves that the recorded payload has not been altered after signing; it does not independently prove that an external-world action actually occurred or that the output is truthful. The Cloudflare Worker scaffold contains the optional x402 payment path; the local HTTP server does not require payment.

### Verifier CLI help

```bash
npm run verify -- --help
```

### Create a receipt

```bash
curl -s http://localhost:4020/v1/proof \
  -H 'content-type: application/json' \
  -d '{"agentId":"demo","action":"paid-api-call","policy":"max-$0.05","input":{"resource":"weather"},"output":{"ok":true},"paymentId":"demo-payment"}'
```

### Verify a receipt file

Save a returned receipt as `receipt.json` and run:

```bash
npm run verify -- receipt.json
```

### JavaScript SDK

```js
import { MachineCommerceProofClient } from './sdk/client.mjs';

const client = new MachineCommerceProofClient('http://localhost:4020');
const { receipt } = await client.createProof({
  agentId: 'my-agent',
  action: 'example-action',
  policy: 'demo-only',
  input: { resource: 'example' },
  output: { ok: true }
});

console.log(await client.verifyReceipt(receipt));
```

The receipt embeds both PEM and SPKI base64 public-key encodings so independent clients can verify the signature without depending on the issuer's runtime.

### MCP adapter

The local server exposes a stateless MCP `2026-07-28` adapter at `POST /mcp` with `server/discover`, `tools/list`, and `tools/call`. See `docs/mcp.md` for a working request.

### Verify the local chain

```bash
curl -s http://localhost:4020/v1/verify-chain
```

## Docker

Fresh-clone container deployment:

```bash
docker compose up -d --build
npm run status
```

The Docker image creates its own `/app/data` runtime volume; no local `data/` folder is needed before building.

For a smoke test:

```bash
./scripts/docker-check.sh
```

## Repository safety

The project is prepared for a **brand-new GitHub repository only**. The publishing helper refuses to overwrite an existing `origin`. No existing repository is required or modified by the project.

## Automation boundary

Safe automation includes public endpoint checks, readiness scanning, receipt generation, metrics, research and draft content. Human approval remains required for financial/custodial actions, legal representations, token issuance or sales, and outbound commercial messaging.

## Generated state

Local signing keys, receipts, research artifacts and runtime data are generated at runtime and ignored by Git. No private signing key is distributed with this release.

## Operator quickstart

For a complete operator walkthrough, read `docs/operator-manual.md`. The fastest routine is:

```bash
npm test
npm run verify-release
npm run demo
```

For a running deployment:

```bash
npm start
npm run status
```

Use `MCP_BASE_URL=https://your-service.example npm run status` to check a deployed service.

## First public demo

The quickest fresh-clone demonstration is:

```bash
npm test
./scripts/verify-example.sh
npm start
```

Then inspect `/health`, `/.well-known/agent-proof.json`, and `/v1/stats`.
See `docs/first-demo.md` for the complete walkthrough.

## GitHub automation behavior

Scheduled workflows are intentionally read-only with respect to repository contents. Research and operations outputs are uploaded as workflow artifacts rather than committed automatically. This keeps unattended runs from rewriting the public codebase.

The health workflow uses the optional `MCP_HEALTH_URL` repository secret; without it, the scheduled probe skips rather than contacting an unrelated public service.

### A2A receipt profile

A2A support is a **narrow synchronous 1.0 service profile** in the Node reference server: it publishes an Agent Card, supports `SendMessage` + `GetTask`, and also exposes the HTTP+JSON `POST /message:send` + `GET /tasks/{id}` pair. It does not claim full A2A feature coverage such as streaming or push notifications. The Cloudflare Worker remains mapping-only until its task service is implemented.

The service is documented in `docs/a2a-service.md` and discovered at `/.well-known/agent-card.json`.

### Conformance

Run `npm run conformance`. The command starts its own isolated test server. The conformance suite checks the implemented MCP surface, the public capability descriptor, the stable receipt schema, and protocol-status declarations. It does not claim full MCP, x402, A2A or ERC-8004 certification. See `docs/interop-claims.md` for the exact tested/not-tested boundary.

## A2A status

The repository includes a live-profile A2A 1.0 Agent Card for the Node reference server plus structured-data receipt mapping. The implemented profile is intentionally narrow: synchronous `SendMessage` + `GetTask` and `GetTask` retrieval, with no streaming or push notifications. See `docs/a2a-agent-card.md` and `docs/a2a-service.md`.

### Official SDK interoperability

A separate CI workflow can install the current official protocol packages and exercise the project with them:

- `@a2a-js/sdk@1.0.1` for the A2A 1.0 client path.
- `@modelcontextprotocol/core@2.0.0` for exact MCP 2026-07-28 wire-schema validation.

Run locally after installing those packages with:

```bash
npm install --no-save @a2a-js/sdk@1.0.1 @modelcontextprotocol/core@2.0.0
npm run official-sdk-interop
```

This remains an interoperability check, not a claim of official certification. The official A2A TCK and the full MCP conformance suite are separate validation programs.


## Fresh-clone reproducibility

A fresh checkout can run `npm run verify-release` without credentials or external services. The command launches isolated local tests, validates the example receipt, checks the release manifest, and confirms generated/secret files are absent.

## Operator audit

Use `npm run audit` to inspect a service health snapshot. The report intentionally omits raw receipt inputs, outputs and payment details. See `docs/audit.md`.

## Operator audit

Run `npm run audit` against a running service. You can also open `web/audit.html` and enter a service URL. The audit excludes raw inputs, raw outputs and payment details.

## Operator continuity

Use `npm run backup` for non-destructive runtime backups and `npm run restore-check` to validate a backup before recovery. See `docs/backup-recovery.md`.

## Operator diagnostics

Run the preflight checks before a new deployment:

```bash
npm run bootstrap-check
npm run doctor
```

`doctor` is safe to run against a local or configured remote service. It checks runtime prerequisites, version consistency, discovery endpoints, health, audit availability, and independent verification of the bundled example receipt. It does not modify runtime data.

## Public deployment security

The reference server now supports configurable CORS, proof-write authorization, admin authorization for stored receipt/task reads, security headers, request IDs, and per-client rate limiting. These controls are disabled/relaxed for local development but should be configured explicitly for production. See `docs/deployment.md` and `docs/operator-manual.md`.
