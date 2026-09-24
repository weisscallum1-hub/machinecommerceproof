# Interoperability Contract

The project treats the receipt as the stable interface and protocols as adapters. A consumer should be able to validate a receipt without running the original agent, payment facilitator or model runtime.

## Required verification inputs

A receipt verifier needs:

1. the receipt JSON,
2. either `signer.publicKeyPem` or `signer.publicKeySpkiB64`,
3. the signer's `keyFingerprint`, and
4. the receipt `signature` and `receiptHash`.

The cryptographic payload normalizes away the two redundant public-key encodings. This means a consumer can retain PEM, SPKI base64, or both without changing the signed meaning of the receipt.

## Verification sequence

```text
parse JSON
  -> canonicalize
  -> derive signer fingerprint from SPKI
  -> compare fingerprint
  -> verify receipt hash
  -> verify Ed25519 signature
  -> interpret attestation scope
```

The current attestation scope is `integrity-only`. Do not interpret `verified: true` as a claim that a real-world event occurred.

## Protocol boundaries

- x402: payment signaling / settlement metadata.
- MCP: tool/resource transport and capability exposure.
- A2A: agent-to-agent task interoperability.
- ERC-8004: external agent identity/reputation/validation references.

The core receipt does not require any of these protocols.
