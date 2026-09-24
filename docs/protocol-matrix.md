# Protocol Matrix

Machine Commerce Proof keeps protocol-specific behavior behind adapters. The receipt cryptographic core is independent of payment and agent-transport protocols.

| Layer | Current reference (checked 2026-09-23) | Role | Status in this project |
|---|---|---|---|
| x402 | v2 | Machine payment signaling / settlement | Adapter boundary; disabled by default |
| MCP | 2026-07-28 | Agent-to-tool integration | Implemented minimal stateless adapter |
| A2A | 1.0.0 | Agent-to-agent collaboration | Receipt-Part mapping only; no A2A server claimed |
| ERC-8004 | Draft standard | Agent identity / reputation / validation | Mapping boundary |

## Design rule

The core receipt format must remain useful if one protocol changes, forks or disappears. Version-specific semantics belong in adapters and documentation.

## Primary references

- x402 v2: https://github.com/x402-foundation/x402/blob/main/specs/x402-specification-v2.md
- MCP 2026-07-28: https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2026-07-28/index.mdx
- A2A 1.0.0: https://a2a-protocol.org/v1.0.0/
- ERC-8004: https://eips.ethereum.org/EIPS/eip-8004
