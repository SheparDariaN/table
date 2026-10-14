# Architecture Overview

Table VTT is a deployable modular monolith: one API process and database, with strongly separated modules and independently versioned external contracts.

## Principles

- **Authoritative server:** clients send commands; the API validates permissions and expected revision, applies domain logic, commits, then emits canonical events.
- **PostgreSQL source of truth:** caches and client projections are disposable. Durable recovery starts from PostgreSQL.
- **Inward dependencies:** delivery and persistence adapters depend on application/domain ports. Domain packages have no infrastructure dependencies.
- **Versioned boundaries:** HTTP, realtime events, persisted payloads, converter IR, and ruleset contracts carry explicit versions.
- **Determinism:** reducers and conversion produce identical output from identical ordered inputs.

## Runtime shape

```text
Web UI/Pixi ── HTTP commands + WS subscription ── API
                                                   │
                     modules/use cases/domain ports│
                                                   │
                                      PostgreSQL + outbox
```

Each command includes an idempotency key and, when mutating revisioned state, an expected revision. A transaction stores state changes and outbox records atomically. Realtime publication occurs from committed outbox records. On gaps or reconnect, clients replace projections from an authorized snapshot.

## Module boundaries

Modules own their schema access, application operations, and public exports. Cross-module work uses typed commands, queries, domain events, or narrow ports. Direct imports of another module's internals and cross-module table writes are prohibited.

## Failure model

- Invalid/unauthorized/conflicting commands produce stable typed errors and no state change.
- Duplicate commands return the original result or an equivalent acknowledgment.
- Event publication is at-least-once; consumers deduplicate by event ID and revision.
- Unknown contract versions fail closed with upgrade guidance.

See `module-map.md`, `data-flow.md`, and ADRs under `docs/adr`.
