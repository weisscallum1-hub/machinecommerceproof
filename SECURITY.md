# Security Policy

## Scope

Machine Commerce Proof handles signed execution evidence. It is not a custody system, wallet, exchange, trading bot, or investment product.

## Reporting

Do not publish secrets, private keys, payment credentials, or exploit details in public issues. Report a suspected security vulnerability privately to the maintainer before disclosure.

## Key handling

Production signing keys must be stored in a secret manager and rotated under an explicit operational procedure. Never commit PEM/PKCS#8 private keys, wallet seeds, access tokens, or facilitator credentials.

## Runtime controls

The reference server supports `PROOF_WRITE_TOKEN` for receipt creation, `ADMIN_TOKEN` for stored receipt/task access, `CORS_ORIGIN` for production cross-origin access, and `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` for request throttling. Prefer separate high-entropy secrets for proof writes and administration.

Use `npm run generate-secrets` to generate high-entropy bearer secrets for local/prototype configuration. Keep the resulting values outside version control.
