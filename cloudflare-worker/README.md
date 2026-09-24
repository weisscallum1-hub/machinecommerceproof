# Cloudflare Workers deployment

This folder is the serverless deployment target for the prototype. Cloudflare currently documents a Workers Free limit of 100,000 requests/day and D1 Free limits of 5 million row reads/day and 100,000 row writes/day; D1 free-tier daily limits are now enforced and queries fail after the included quota is exhausted until the reset. Verify current limits before production. citeturn931213search0turn931213search1turn931213search3

## Setup

1. Install Wrangler.
2. Create a **new** D1 database: `wrangler d1 create machine-commerce-proof`.
3. Put the returned database ID into `wrangler.toml`.
4. Apply schema: `wrangler d1 execute machine-commerce-proof --remote --file=migrations/0001_init.sql`.
5. Generate an Ed25519 keypair. Store the PKCS#8 private key as `ED25519_PRIVATE_PKCS8_B64` and the SPKI public key as `ED25519_PUBLIC_SPKI_B64`.
6. Set `ED25519_PUBLIC_FINGERPRINT` to the first 32 hexadecimal characters of SHA-256(SPKI DER).
7. Configure x402 environment variables only when enabling the paid route.
8. Deploy: `wrangler deploy`.

## Production design notes

- Receipts carry enough public verification material to be checked independently of the current server process.
- The D1-backed chain is an append-oriented prototype, not a globally immutable ledger. High-concurrency production deployments should use an external anchoring or Merkle-batch strategy rather than relying on a single `previousReceiptHash` row.
- Never store wallet seeds or signing keys in source control.
- Keep the x402 integration behind the adapter boundary so protocol changes do not require rewriting the proof core.
