# ADR 0007: Ruleset Boundary

- Status: Accepted
- Date: 2026-10-14

## Context

Core VTT concepts are shared, while game systems define different character data, rolls, resources, validation, and import mappings.

## Decision

Keep the core domain ruleset-neutral. Game-specific behavior implements a versioned ruleset contract identified by ruleset ID and version. The boundary exposes narrow pure operations for schema validation, derived values, actions/roll plans, and import mapping.

Rulesets receive explicit immutable context and capability-limited ports. They do not access database, network, filesystem, process globals, or transport types. Persisted ruleset data is opaque to core but runtime-validated by its owning ruleset.

## Consequences

- Multiple systems can coexist without branching core concepts.
- Ruleset availability/version becomes part of campaign compatibility.
- Contract fixtures and conformance tests are required.
- Missing or incompatible rulesets fail closed while preserving raw persisted data for recovery/migration.
