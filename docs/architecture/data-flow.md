# Data Flow

## Authoritative command

1. Web sends `{ contractVersion, commandId, expectedRevision, payload }`.
2. API authenticates, parses, and authorizes against current durable membership/state.
3. Application service opens a transaction and checks idempotency/revision.
4. Domain function returns new state and versioned events, or a typed rejection.
5. Adapter persists state, command result, and outbox records atomically.
6. API acknowledges the committed revision.
7. Outbox publisher emits canonical events; clients deduplicate and apply in revision order.

## Reconnect and gaps

The client supplies its last applied revision. The API may replay retained authorized events; otherwise it returns a full authorized snapshot. A revision gap stops incremental application until replay or snapshot replacement completes.

## Query

Queries authenticate and authorize before reading module-owned projections. Caches may accelerate reads but cannot grant access or become recovery sources. Responses identify their contract and state revision where consistency matters.

## Import

```text
upload adapter → bounded decode → normalized source
→ pure converter-core → versioned IR + diagnostics
→ validate/preview → authorized apply command → PostgreSQL
```

Import IDs derive from canonical source identity, making retries stable. Applying IR is transactional or explicitly chunked with resumable status.

## Sensitive data

Visibility filtering occurs server-side before snapshots/events leave the API. Logs contain correlation IDs and stable error codes, not secrets, private content, hidden entities, or raw payloads.

## Ordering guarantees

- Revisions are monotonic within an aggregate/scene stream, not globally.
- Event delivery is at-least-once.
- Presence is ephemeral and may be dropped; game state is durable.
- Clients must tolerate duplicate events but never silently skip a revision.
