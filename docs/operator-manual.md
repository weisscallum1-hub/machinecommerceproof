# Operator Manual

## 1. What you operate

Machine Commerce Proof is a local-first service for producing and independently verifying tamper-evident receipts for software actions. The core proof is integrity-only: a valid receipt proves the signed record was not altered after signing; it does not prove that an external-world event really happened.

The normal operating model is:

`start service -> create receipts -> verify receipts/chain -> expose MCP/A2A -> monitor -> rotate/review -> deploy`

The project does not require a blockchain, wallet, token, payment provider, database account, or LLM to run locally.

## 2. First run

Requirements:

- Node.js 22+
- Python 3.12+ for the bundled agents
- curl for the command-line examples

From the repository root:

```bash
npm test
npm run verify-release
npm run demo
```

`npm run demo` starts an isolated server on port 4020, creates a demo receipt, shows statistics, and removes the temporary runtime directory when it exits.

## 3. Start the service

```bash
npm start
```

Default URL:

`http://localhost:4020`

Optional settings:

```bash
PORT=4020 DATA_DIR=/path/to/runtime-data npm start
```

`DATA_DIR` should be treated as sensitive runtime state because it contains the generated Ed25519 signing key and local receipt/task logs. Never commit it.

## 4. Check service status

With the server running:

```bash
npm run status
```

To check another deployment:

```bash
MCP_BASE_URL=https://example.com npm run status
```

The command checks health, the public capability descriptor, the A2A Agent Card and statistics.

## 5. Create a receipt

```bash
curl -s http://localhost:4020/v1/proof \
  -H 'content-type: application/json' \
  -d '{"agentId":"demo-agent","action":"quote_service","policy":"allowed","input":{"sku":"demo"},"output":{"price":39}}'
```

The response contains the signed receipt. Save the `receipt` object as JSON if you want to verify it independently.

## 6. Verify a receipt

```bash
npm run verify -- /path/to/receipt.json
```

Or verify the included fixture:

```bash
./scripts/verify-example.sh
```

A successful result includes `verified: true`, `hashValid: true`, `signatureValid: true`, and `signerFingerprintValid: true`.

## 7. Verify the chain

```bash
curl -s http://localhost:4020/v1/verify-chain
```

The chain verifier checks the local receipt sequence and its hash links.

## 8. MCP operation

The local reference server exposes the narrow stateless MCP adapter at:

`POST /mcp`

The supported surface is discover/list/call for the proof tools. Run:

```bash
npm run conformance
```

for the repository's wire-level conformance suite.

See `docs/mcp.md` for example requests.

## 9. A2A operation

The Node reference server publishes:

`GET /.well-known/agent-card.json`

and exposes the narrow synchronous A2A 1.0 service described in `docs/a2a-service.md`.

Run:

```bash
npm run a2a-service
npm run interop
```

The supported profile is intentionally limited; it does not claim full streaming, push-notification, or every-task-feature coverage.

## 10. x402

x402 is an integration boundary in this release. The local reference server does not silently execute real payments.

The Cloudflare deployment scaffold includes the optional payment path, which must be configured explicitly before it can be used. Review `docs/legal-gates.md` before enabling any real-money flow.

## 11. Agents

The `agents/` directory contains deterministic research/operations helpers:

- `scout.py` — ecosystem research
- `readiness.py` — public service readiness analysis
- `lead_finder.py` — public lead discovery
- `health.py` — configured endpoint checks
- `revenue.py` — metrics calculations
- `strategy.py` — strategy snapshot
- `content.py` — draft content generation
- `risk.py` — human-approval/risk gate

Run an individual agent directly, for example:

```bash
python agents/scout.py
```

The GitHub Actions workflows run only the safe monitoring/reporting tasks automatically and upload their outputs as artifacts rather than rewriting repository source.

## 12. Container operation

The repository includes a self-contained Docker deployment that does not require a pre-existing `data/` directory. The runtime data volume contains the signing key and receipt/task logs.

Build and start:

```bash
docker compose up -d --build
```

Check:

```bash
curl -fsS http://localhost:4020/health
npm run status
```

Stop without deleting persistent data:

```bash
docker compose down
```

Stop and delete the named runtime volume (including the signing key and local receipt history):

```bash
docker compose down -v
```

The container image is intended for a prototype/operator deployment. Put authentication, TLS, edge rate limits and secret-management controls in front of any public production deployment.

## 12. Deployment

The supported prototype path is:

`GitHub Pages (static web) + Cloudflare Workers/D1 (API) + GitHub Actions (automation)`

Read:

- `docs/deployment.md`
- `docs/legal-gates.md`
- `docs/public-launch-checklist.md`

before deployment.

## 13. Secrets and key management

On first start the local service generates its own Ed25519 keypair in `DATA_DIR`.

Back up the private key only through a proper secret-management process. Do not paste it into issues, chat, Git commits, workflow logs or public artifacts.

If the private key is lost, old receipts can still be independently checked only if the public key/signature information necessary for verification remains available; new receipts will use a newly generated identity after key regeneration.

## 14. Health and maintenance

For an unattended deployment, configure `MCP_HEALTH_URL` in GitHub Actions to the exact service you own and want checked.

The scheduled workflows are deliberately read-only against repository contents. Review workflow artifacts periodically.

For protocol changes, rerun:

```bash
npm run verify-release
npm run conformance
npm run interop
```

Then review the official protocol release notes before changing adapters.

## 15. Publication workflow

For the first public repository:

1. Create a new empty repository named `machine-commerce-proof`.
2. Publish this source tree to that repository.
3. Confirm GitHub Actions are enabled.
4. Run the CI and official-SDK interoperability jobs.
5. Configure only the secrets you actually need.
6. Deploy the static site and API separately.

The project is designed so that repository automation does not mutate source code during scheduled research runs.

## 16. What not to automate

Keep human approval for:

- financial transfers or custody
- token issuance or sales
- legal/compliance representations
- contract upgrades
- customer-specific public claims
- outbound commercial messaging

The risk gate is there to force those actions into a human-controlled workflow.

## 15. Backup and recovery

The receipt history and public verification material can be backed up without exporting the private signing key:

```bash
npm run backup -- --destination=./backups
```

That creates a timestamped backup containing the receipt log, A2A task log, public key and a SHA-256 manifest. The default backup is suitable for independently preserving and re-verifying historical receipts.

To validate a backup without changing runtime state:

```bash
npm run restore-check -- --source=./backups/mcp-proof-backup-<timestamp>
```

Including the signing key requires an explicit opt-in:

```bash
npm run backup -- --include-private-key --destination=/secure/offline/location
```

Treat that backup as a high-sensitivity secret. Keep it outside the repository and use controlled secret storage. The application does not upload backups anywhere automatically.

A restore is intentionally a manual operation: first stop the service, validate the backup with `restore-check`, copy the approved runtime files into a new `DATA_DIR`, then start the service and run `npm run status` and `npm run audit`. Do not overwrite a healthy runtime directory before validating the backup.

The design follows standard key-lifecycle guidance: protect signing keys separately, plan recovery before an incident, and keep the ability to rotate or replace keys without silently rewriting historical evidence.

## 18. Public deployment security

Before putting the Node service directly on the public internet, configure at minimum:

```bash
NODE_ENV=production
CORS_ORIGIN=https://your-allowed-origin.example
PROOF_WRITE_TOKEN=<random-secret>
ADMIN_TOKEN=<different-random-secret>
RATE_LIMIT_MAX=120
RATE_LIMIT_WINDOW_MS=60000
```

Run:

```bash
npm run security-test
npm run doctor
npm run verify-release
```

Do not put either token in the repository or workflow logs. Use a secret manager or GitHub Actions encrypted secret store.

Generate the two high-entropy bearer secrets with:

```bash
npm run generate-secrets
```

Place the values in an untracked environment/secret manager. Never paste them into issues, commits or workflow logs.

When using Docker Compose, place those values in an untracked `.env` beside `docker-compose.yml`; the Compose file forwards them into the service.
