# Changelog

## 0.21.1

- Added operator audit endpoint and dashboard.
- Added receipt-specific verification endpoint.
- Added request ID correlation headers.
- Added reproducible audit CLI.
- Added audit privacy semantics that exclude raw inputs, outputs and payment details.
- Added release-gate coverage for the new operator surface.


- Added operator manual and `npm run status`.
- Added root `npm run demo` convenience command.
- Documented first-run, key management, monitoring, MCP/A2A operation and deployment procedures.

# Changelog

## 0.15.0

- Added a one-command fresh-clone verification path.
- Added an explicit third-party interoperability runbook.
- Kept official SDK interoperability as CI-only when package installation is unavailable locally.
- Added release-gate coverage for protocol-version consistency and generated/secret file hygiene.

## 0.14.0

- Added optional third-party interoperability checks using the current official A2A JavaScript SDK and MCP wire schemas.
- Added a CI workflow that installs pinned official SDK versions and runs the interoperability harness.
- Added explicit A2A 1.0 service-profile capability notes and hardened verifier-service metadata.
- Kept official-client/TCK status separate from local raw-wire conformance claims.

## 0.13.0

- Hardened A2A task history semantics (`historyLength=0` returns no history).
- Added explicit verification-service capability metadata.
- Tightened protocol interoperability and release checks.
- Aligned OpenAPI metadata with the 0.13.0 release.

## 0.12.0

- Added narrow A2A 1.0 JSON-RPC + HTTP+JSON service profile for synchronous receipt verification.
- Added Agent Card discovery at `/.well-known/agent-card.json`.
- Added A2A task persistence and GetTask support.
- Added A2A service integration tests and SDK helpers.

# Changelog

## 0.11.0
- Added A2A 1.0 Agent Card deployment template.
- Added SDK helpers for A2A structured-data receipt Parts.
- Added A2A round-trip interoperability test.
- Clarified that the project does not claim full A2A server conformance.
- Financial and token functionality remains deferred.

## 0.9.0

- Added A2A receipt-Part mapping profile and explicit protocol capability statuses.
- Added protocol conformance test suite.
- Updated MCP/x402/A2A interoperability metadata and SDK version.


## 0.8.0

- Added a stateless MCP 2026-07-28 adapter with discovery, deterministic tool listing and proof/verification tools.
- Added MCP conformance checks to the self-test.
- Aligned the Cloudflare Worker with the local MCP envelope.
- Documented the deliberately limited MCP feature surface.


## 0.8.0

- Added dual public-key encoding support (PEM + SPKI base64) for portable receipt verification.
- Added cross-runtime key-pair mismatch detection at startup.
- Added protocol matrix and threat-model documentation.
- Updated browser verifier and Worker metadata for the new public-key encoding.
- Made Worker x402 availability reflect whether production configuration is actually present.
- Reworked landing page into a deterministic demo without a non-existent `/scan` backend.
- Added SDK/interoperability guidance.



## 0.6.0 — SDK, integrity semantics and validation

- Added a small JavaScript client SDK for automated callers.
- Added explicit `integrity-only` attestation semantics and `untrusted` input provenance.
- Corrected x402 metadata in the local prototype to distinguish adapter readiness from enforcement.
- Added stronger request validation and malformed-JSON handling.
- Added worker receipt compatibility for SPKI public-key encoding.


## 0.5.0 — public-demo hardening

- Treat GitHub scheduled automation as read-only by default.
- Upload scout/ops output as workflow artifacts instead of automatically committing generated files.
- Make health checks target a configurable `MCP_HEALTH_URL` secret instead of `example.com`.
- Add a first-demo guide and an example receipt verification helper.
- Align package/runtime version strings at `0.5.0`.

## 0.4.1

- Ed25519-signed, hash-linked receipts.
- Independent CLI and browser verification.
- x402 / MCP / ERC-8004 / A2A adapter boundaries.

## 0.21.1

- Added operator backup workflow with explicit private-key opt-in.
- Added backup manifest hashing and non-destructive restore validation.
- Added recovery procedure to the operator manual.

## 0.21.1

- Added `npm run bootstrap-check` for fresh-clone prerequisites.
- Added `npm run doctor` for read-only operator diagnostics.
- Added explicit release documentation for pre-deployment diagnostics.

## 0.21.1

- Fixed restore validation to accept the timestamped backup directory returned by the backup command or its parent directory.
- Added a release-gate regression check for backup-source resolution.

## 0.21.1

- Added `npm run doctor` and `npm run bootstrap-check` operator diagnostics.
- Fixed backup restore validation to accept the timestamped backup directory or its parent directory.
- Added a release-gate regression check for backup-source resolution.
- Documented operator continuity and release-state boundaries.
