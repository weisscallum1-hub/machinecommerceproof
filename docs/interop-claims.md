# Interoperability Claims Matrix — v0.21.1

This document separates locally tested protocol behavior from formal certification.

| Surface | Implemented | Locally tested | Official SDK/TCK run | Public claim |
|---|---:|---:|---:|---|
| Receipt core | Yes | Yes | N/A | Portable integrity-only receipt format |
| MCP 2026-07-28 minimal adapter | Yes | Yes | Official core schemas validate `tools/list` and `tools/call` | Minimal MCP adapter, not full MCP certification |
| A2A 1.0 Agent Card | Yes | Yes | Official JavaScript SDK discovers and uses it | Narrow synchronous A2A service profile |
| A2A 1.0 JSON-RPC | `SendMessage`, `GetTask` | Success, error mapping, history and version cases | Official JavaScript SDK client check | Implemented methods only; no full conformance claim |
| A2A 1.0 HTTP+JSON | `POST /message:send`, `GET /tasks/{id}` | Success, error mapping, history and version cases | Not separately exercised by the SDK workflow | Implemented methods only; no full conformance claim |
| A2A streaming | No | No | No | Not implemented; not advertised |
| A2A push notifications | No | No | No | Not implemented; not advertised |
| x402 v2 payment envelope mapping | Yes | Yes | No | Adapter/shape validation only |
| x402 payment verification/settlement | No | No | No | Disabled; no live payments executed |
| ERC-8004 | Mapping boundary | Yes | No | Compatibility boundary only |

## Test limitations

The A2A service test covers the two bindings and methods advertised by the Agent Card, including malformed requests, invalid parameters, unknown tasks, version negotiation, task history, and equivalent receipt-verification results. The official A2A JavaScript SDK successfully calls the JSON-RPC profile. These checks do not replace the official A2A TCK.

The official A2A TCK was not run. The service intentionally implements only synchronous `SendMessage` and `GetTask`; it does not implement streaming, push notifications, task listing, cancellation, or gRPC. A full TCK result must be reported with that scope and any unsupported-capability exclusions, rather than as a generic certification claim.

The MCP check uses the official core wire schemas; it is not a full MCP client or transport certification. x402 tests validate the v2 `PaymentRequired` data shape and transport mapping only. No blockchain payment or facilitator settlement is executed.
