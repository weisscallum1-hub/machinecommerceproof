# Machine Commerce Proof — Release Status

## Current release

Version: 0.21.1

## Verified in this environment

- Node.js 22.16.0
- Unit/self tests
- MCP protocol conformance
- A2A interoperability and narrow service
- Release consistency checks
- Fresh-clone bootstrap checks
- Operator diagnostics
- Example receipt independent verification
- Tamper detection and receipt-chain validation
- Backup creation and backup manifest verification
- Parent-directory backup restore-check workflow
- Secret/generated-file audit
- Docker image build and Compose runtime, including container healthcheck and `/health`, `/.well-known/agent-card.json`, and `/v1/stats` endpoints
- Official A2A JavaScript SDK client interoperability and MCP official core schema validation

## Not verified here

- Full A2A TCK certification: not claimed.
- Real x402 settlement/payment execution: intentionally disabled by default.

## GitHub state

The project is prepared for a brand-new repository only. Existing user repositories were not modified. Account-level repository creation must be performed externally before publication.

- Production security hardening: configurable CORS, proof-write/admin bearer authorization, rate limiting, security headers, and request correlation.
- Configuration template and high-entropy secret generator.
