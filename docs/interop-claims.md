# Interoperability Claims Matrix — v0.17.0

This document distinguishes local wire-level testing from protocol certification.

| Surface | Implemented | Local wire-tested | Official TCK / SDK run | Public claim |
|---|---:|---:|---:|---|
| Receipt core | Yes | Yes | N/A | Portable integrity-only receipt format |
| MCP 2026-07-28 minimal adapter | Yes | Yes | No | Minimal MCP adapter, not full MCP certification |
| A2A 1.0 Agent Card | Yes | Yes | No | Valid narrow A2A Agent Card surface |
| A2A 1.0 sync service | Yes | Yes | No | Narrow `SendMessage` + `GetTask` service profile |
| A2A streaming | No | No | No | Not implemented |
| A2A push notifications | No | No | No | Not implemented |
| x402 v2 payment envelope mapping | Yes | Yes | No | Adapter/shape validation only |
| x402 payment verification/settlement | No | No | No | Disabled / not implemented |
| ERC-8004 | Mapping boundary | Yes | No | Compatibility boundary only |

## Test limitations

The release uses independent raw HTTP/JSON test clients for MCP and A2A. The official MCP TypeScript SDK was not installed in the build environment because the package-manager attempt timed out; no claim of official SDK interoperability is made from that attempt.

The official A2A TCK was not executed in this environment. The A2A tests validate the implemented wire shapes and behavior against the published specification, but they are not a substitute for the TCK.

x402 tests validate the v2 `PaymentRequired` data shape and transport mapping only. The release does not execute blockchain payments or facilitator settlement.
