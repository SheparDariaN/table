# ADR 0008: Scene and Canvas

- Status: Accepted
- Date: 2026-10-14

## Context

Product language describes a playable Scene, while the existing domain and protocol use Canvas for the rendering aggregate.

## Decision

`Scene` is the product and route term for the playable map, tokens, and future visibility configuration. `Canvas` remains the internal rendering aggregate and persistence record. UI routes use `/table/:worldId/:sceneId`; rendering code may reference a canvas snapshot without exposing that name as navigation.

## Consequences

- User-facing copy and route contracts say Scene.
- Existing canvas commands remain valid until a versioned protocol migration replaces them.
- Future scene snapshots must stay role-filtered before reaching a client projection.
