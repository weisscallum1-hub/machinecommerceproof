# A2A receipt profile

The Node reference server implements a deliberately narrow A2A 1.0 synchronous service profile for receipt verification. It is not a claim of full A2A feature coverage. The Cloudflare Worker currently remains mapping-only.

The receipt can be carried as a structured-data `Part` in an A2A `Message` or `Artifact` using:

```json
{
  "data": {
    "type": "machine-commerce-proof/receipt",
    "version": "0.4",
    "receipt": {"...": "..."}
  },
  "mediaType": "application/vnd.machine-commerce-proof+json"
}
```

The receipt remains independently verifiable; the surrounding A2A task/message lifecycle does not become part of the receipt's cryptographic payload.

The implementation aligns with A2A's data model, where Parts can carry structured JSON data and Agent Cards declare supported interfaces. A2A 1.0 uses `A2A-Version: 1.0` for requests; the JSON-RPC and HTTP+JSON bindings are documented in `docs/a2a-service.md`.

References:
- https://github.com/a2aproject/A2A/blob/main/docs/specification.md
- https://github.com/a2aproject/A2A/blob/main/specification/a2a.proto
