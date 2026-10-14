# API Agent Guide

## Responsibility

HTTP/WebSocket delivery, application orchestration, authentication, and adapter composition.

## Rules

- Handlers parse, authenticate, authorize, invoke one use case, and map typed results.
- Validate request, response, and event payloads at runtime.
- Clients send commands, never trusted state mutations.
- Commit durable changes before acknowledging or broadcasting them.
- Make command retries idempotent with command IDs and expected revisions.
- Keep transactions short; pass transaction-scoped ports explicitly.
- Map internal failures to stable error codes without leaking stack traces or SQL details.
- Enforce object-level authorization for every campaign, scene, actor, and asset operation.
- Apply request size, rate, timeout, and upload limits at transport boundaries.

## Testing

- Unit-test handlers with fake ports.
- Integration-test PostgreSQL transactions and WebSocket ordering.
- Contract-test every supported API/event version.
