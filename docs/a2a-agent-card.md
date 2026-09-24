# A2A Agent Card companion

The Node reference server provides a deliberately narrow A2A 1.0 service profile. `examples/a2a-agent-card.json` matches that profile; it is not a claim of full A2A feature coverage or certification.

A2A 1.0 requires an Agent Card describing identity, skills and supported interfaces. The current specification places protocol version and binding on each `supportedInterfaces[]` entry, with public discovery at `/.well-known/agent-card.json`.

The deployed card advertises only operations implemented by the reference server. The reference implementation does not advertise streaming, push notifications, task cancellation, task listing, or extended-card operations.

The supported interoperability path is:

1. Discover `/.well-known/agent-card.json`.
2. Use the declared JSON-RPC or HTTP+JSON interface with `A2A-Version: 1.0`.
3. Send a `Message` containing a Machine Commerce Proof structured-data Part.
4. Receive a completed `Task` containing a proof-verification artifact.
5. Retrieve the task with `GetTask` or `GET /tasks/{id}`.

This profile remains intentionally smaller than the full A2A protocol.

References:
- https://a2a-protocol.org/latest/topics/agent-discovery/
- https://a2a-protocol.org/latest/definitions/
- https://a2a-protocol.org/latest/whats-new-v1/
