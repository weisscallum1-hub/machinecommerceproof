# MCP 2026-07-28 adapter

Machine Commerce Proof exposes a deliberately small, stateless Model Context Protocol adapter at `POST /mcp`.

## Implemented surface

The adapter speaks MCP `2026-07-28` and currently supports:

- `server/discover`
- `tools/list`
- `tools/call`

Exposed tools:

- `create_proof`
- `verify_receipt`
- `verify_chain`
- `get_stats`

Every request is validated for the MCP protocol version, required `_meta` fields, and the `Mcp-Method` / `Mcp-Name` request headers.

The `tools/list` response is deterministic and includes `ttlMs` and `cacheScope` so clients can cache the result according to the protocol.

## Example request

```http
POST /mcp
Content-Type: application/json
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tools/call
Mcp-Name: create_proof
```

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "create_proof",
    "arguments": {
      "agentId": "demo-agent",
      "action": "example-action",
      "policy": "demo-only",
      "input": {"resource": "example"},
      "output": {"ok": true}
    },
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientInfo": {"name": "example-client", "version": "1.0.0"},
      "io.modelcontextprotocol/clientCapabilities": {}
    }
  }
}
```

## Scope

This adapter intentionally implements only the stateless MCP surface needed for proof creation and verification. It does not claim full MCP feature coverage, such as Tasks or MCP Apps.

The implementation follows the official `2026-07-28` specification concepts: no protocol-level initialization handshake, request-level protocol metadata, standard method/name headers, deterministic tool lists, cache hints, and structured tool results.
