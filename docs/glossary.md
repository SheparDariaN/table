# Glossary

- **Aggregate:** consistency boundary updated atomically by one command.
- **Authoritative state:** canonical state accepted by the server after validation and commit.
- **Command:** idempotent request expressing user intent; it may be rejected.
- **Contract:** runtime-validated shape crossing a process, module, persistence, or plugin boundary.
- **Domain event:** immutable, versioned fact produced by accepted domain behavior.
- **Expected revision:** client-known revision used for optimistic concurrency control.
- **IR:** versioned intermediate representation emitted by converter-core.
- **Module:** cohesive ownership boundary with public contracts and hidden internals.
- **Outbox:** records committed with state and later published to realtime consumers.
- **Projection:** derived read/client state rebuildable from canonical data.
- **Revision:** monotonic sequence number within a state stream.
- **Ruleset:** game-system-specific mechanics behind the ruleset boundary.
- **Scene:** playable map plus grid, walls, tokens, lighting, and visibility configuration.
- **Snapshot:** authorized complete state at a declared revision.
- **Source adapter:** impure reader that decodes external content into normalized converter input.
- **VTT:** virtual tabletop.
