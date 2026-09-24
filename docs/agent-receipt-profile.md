# Agent Receipt Profile

Use this profile when an agent wants to emit a portable integrity receipt after an action.

## Minimal request

```json
{
  "agentId": "example-agent",
  "action": "lookup",
  "policy": "read-only",
  "input": {"resource": "example"},
  "output": {"ok": true}
}
```

## Design guidance

Keep sensitive inputs and outputs out of receipts. Hash them rather than storing raw contents when another party only needs evidence of integrity. Include an external transaction or task identifier in `paymentId` or a future protocol-specific field when there is an actual durable identifier.

Never describe the receipt as a proof that an external event occurred unless an independent validator has attested to that event.
