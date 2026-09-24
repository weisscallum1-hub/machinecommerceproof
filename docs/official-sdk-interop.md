# Official SDK interoperability check

This project has two interoperability layers:

1. **Local wire tests** — run without third-party packages and validate the published protocol envelopes.
2. **Official SDK checks** — a separate CI workflow installs the pinned official protocol packages and exercises the live local server.

## Current pins

- `@a2a-js/sdk@1.0.1` — official A2A JavaScript SDK stable 1.0 line.
- `@modelcontextprotocol/core@2.0.0` — official MCP TypeScript SDK v2 core wire-schema package for the 2026-07-28 revision.

The official A2A SDK documents `ClientFactory.createFromUrl()` and `Client.sendMessage()`. The MCP SDK documents the v2 package split and the use of `@modelcontextprotocol/core` for exact wire schemas.

## Run

The local environment does not require these packages. To run the third-party pass locally, install them first:

```bash
npm install --no-save @a2a-js/sdk@1.0.1 @modelcontextprotocol/core@2.0.0
npm run official-sdk-interop
```

The GitHub Actions workflow performs this installation automatically.

## Scope

The A2A portion uses the official SDK as a client against the project's narrow synchronous service profile. The MCP portion uses the official core wire schemas to validate `tools/list` and `tools/call` response envelopes; it does not claim that the custom `/mcp` endpoint is a full Streamable HTTP transport implementation.

This is an interoperability signal, not an official conformance certification.

## References

- https://github.com/a2aproject/a2a-js
- https://github.com/modelcontextprotocol/typescript-sdk
