# Third-party client interoperability

This project separates three claims:

1. **Local wire conformance** — the repository tests its own HTTP/JSON-RPC envelopes.
2. **Official SDK interoperability** — GitHub Actions installs the pinned official SDKs and runs the independent client harness.
3. **Official certification** — this project does not claim MCP TCK or A2A TCK certification.

## Official client check

The CI job installs:

- `@a2a-js/sdk@1.0.1`
- `@modelcontextprotocol/core@2.0.0`

Then it runs `npm run official-sdk-interop`.

A local run may fail when the package registry is unavailable or times out. That is treated as **not observed locally**, not as evidence that interoperability fails.

## Expected proof

A passing run must show:

- A2A Agent Card discovery.
- A2A `SendMessage` and `GetTask`.
- MCP `tools/list` validation against the official wire schema.
- MCP `tools/call` validation against the official wire schema.
- A receipt that remains independently verifiable after transport.
