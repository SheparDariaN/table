# Module Map

## Deployable applications

- `apps/web`: browser shell, accessible UI, local projections, API client, and Pixi renderer.
- `apps/api`: composition root, HTTP/WS delivery, authentication, use-case orchestration, transactions, and outbox publisher.

## Shared packages

- `packages/domain`: VTT-neutral domain types, invariants, commands/events, policies, and ports.
- `packages/converter-core`: pure normalized-input to versioned-IR pipeline.

Additional packages should represent a cohesive boundary, not a generic utility bucket.

## Logical API modules

- **Identity:** users, sessions, principals.
- **Campaign:** membership, roles, campaign metadata.
- **Scene:** maps, grid, walls, visibility, scene revision.
- **Actor/Token:** actors, token instances, ownership, resources.
- **Asset:** metadata and access policy; binary storage remains an adapter concern.
- **Realtime:** subscriptions, snapshots, sequencing, presence.
- **Import:** source adapters, converter orchestration, IR application.
- **Ruleset:** discovery and invocation of versioned ruleset implementations.

## Allowed dependency direction

```text
web presentation → web application → contract client
api delivery → api application → domain
api adapters ───────────────────→ domain ports
source adapters → converter-core → converter IR
ruleset adapters ───────────────→ ruleset boundary
```

Domain and converter-core do not import applications, adapters, UI, persistence, or vendor packages. Web does not import API internals. Modules may depend on another module's explicit public contract only.

## Ownership checks

Before changing code, identify:

1. Which module owns the invariant and data?
2. Is the dependency using a public entry point?
3. Does the operation need a command, query, event, or port?
4. Does the boundary require a version or compatibility test?
