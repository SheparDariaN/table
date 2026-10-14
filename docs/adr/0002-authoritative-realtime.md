# ADR 0002: Authoritative Realtime

- Status: Accepted
- Date: 2026-10-14

## Context

Multiple players concurrently mutate shared state. Trusting client state would permit cheating, divergence, and inconsistent authorization.

## Decision

Clients send versioned commands with a command ID and expected stream revision. The server authenticates, authorizes, validates, applies domain logic, commits state and outbox records, then emits canonical events.

Delivery is at-least-once. Events carry stable IDs and revisions. Clients deduplicate, apply contiguous revisions only, and recover gaps by replay or an authorized snapshot. Presence is ephemeral and separate from durable game state.

## Consequences

- The server is the consistency and permission authority.
- Optimistic UI is allowed only as a reversible pending projection.
- Idempotency, conflict handling, reconnect, and snapshot replacement are mandatory.
- Added latency is accepted to prevent divergent canonical state.
