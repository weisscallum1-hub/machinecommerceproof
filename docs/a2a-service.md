# A2A service profile

Machine Commerce Proof exposes a deliberately narrow A2A 1.0 service profile for synchronous proof verification. It is not a claim of full A2A server conformance.

## Discovery

`GET /.well-known/agent-card.json` returns the deployed Agent Card. The card advertises JSON-RPC first and HTTP+JSON second.

## JSON-RPC

`POST /a2a` with `A2A-Version: 1.0` supports:

- `SendMessage` — accepts a user Message containing a Machine Commerce Proof receipt Part or a text request to verify the chain.
- `GetTask` — retrieves the completed task.

The service is intentionally synchronous and does not implement streaming or push notifications.

JSON-RPC errors preserve the request ID and use the standard JSON-RPC codes for invalid requests, invalid parameters, and unknown methods. A2A-specific version and task-not-found errors carry `google.rpc.ErrorInfo` details.

## HTTP+JSON

`POST /message:send` with `Content-Type: application/a2a+json` and `A2A-Version: 1.0` performs the same narrow operation. `GET /tasks/{id}` retrieves the task.

A2A 1.0 requires the `A2A-Version` header and uses `application/a2a+json` for the REST binding. See the official specification and SDK documentation.

## Compatibility checks

CI checks Agent Card discovery, both advertised bindings, completed and rejected tasks, context and history handling, malformed requests, unsupported methods, invalid parameters, missing or unsupported versions, and task-not-found error mapping. The official JavaScript SDK is also exercised against the JSON-RPC binding. This profile check does not run or replace the official A2A TCK, and it makes no claim for methods or transports that the Agent Card does not advertise.
