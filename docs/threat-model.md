# Threat Model

Machine Commerce Proof is an integrity-evidence prototype. It is not a truth oracle.

## Assets

- Signing private key
- Receipt integrity
- Receipt ordering / chain links
- Agent and policy metadata
- Optional payment correlation metadata

## Primary threats

### Key substitution
An attacker may replace a public key and fingerprint. Mitigation: fingerprints are derived from the embedded SPKI bytes and verified before signature acceptance.

### Receipt mutation
An attacker may modify action, policy, hashes or payment metadata. Mitigation: receipt hash and Ed25519 signature both fail after mutation.

### Chain tampering
An attacker may remove, reorder or splice receipts. Mitigation: each receipt carries the previous receipt hash and the verifier checks the full sequence.

### Replay
A valid receipt can be copied and replayed as evidence in another context. The current integrity-only model does not solve semantic replay. A production system should bind receipts to a task, audience, nonce, expiry and/or external transaction identifier.

### False underlying claims
A valid signature does not prove that an external event actually occurred. The signer could be dishonest or operating on untrusted input. The project therefore labels its attestation scope explicitly as `integrity-only`.

### Private-key compromise
Anyone holding the signing key can generate valid receipts. Production deployments should isolate keys in a managed signing service or HSM and rotate keys with explicit key-identity metadata.

### Data leakage
Receipts may contain sensitive metadata. Production deployments should minimize payloads, hash sensitive inputs/outputs rather than storing raw values, and apply retention/access controls.

## Out of scope for v0.x

- Wallet custody
- Autonomous fund movement
- Investment or trading logic
- Claims of external-world truth
- Full blockchain finality proofs
- Legal/compliance certification
