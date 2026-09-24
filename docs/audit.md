# Operator audit

`GET /v1/audit` returns a compact operational snapshot for a Machine Commerce Proof service.

The report covers service/version/schema, overall chain health, receipt count, a metadata-only summary of the latest receipt, signer fingerprint and protocol status.

For privacy, the audit response intentionally excludes raw receipt inputs, raw outputs and payment details. The endpoint therefore helps diagnose the service without becoming a second public copy of receipt payloads.

Use:

```bash
npm run audit
```

or point the CLI at a deployed service with `MCP_BASE_URL`.

## Trust boundary

A healthy audit means the locally stored receipt chain is internally consistent and the receipts verify under their recorded signing keys. It does not independently attest that an external event happened or that an agent output was truthful.
