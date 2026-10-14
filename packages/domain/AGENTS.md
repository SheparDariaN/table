# Domain Agent Guide

## Responsibility

Business invariants, entities/value objects, commands, events, policies, and ports.

## Rules

- Keep this package framework-, transport-, storage-, renderer-, and vendor-independent.
- Model illegal states out with branded IDs, value objects, and discriminated unions.
- Use pure functions that return new state plus typed events or typed errors.
- Inject clock, ID generation, and ruleset behavior through narrow ports.
- Do not import another module's internals; consume its public contract.
- Domain events describe committed facts in past tense and carry a schema version.
- Ruleset-specific mechanics must implement the ruleset boundary; core VTT concepts stay neutral.
- Avoid generic repositories; define ports around concrete use-case needs.

## Testing

- Use table-driven tests for invariants and permission matrices.
- Use property tests for geometry, reducers, and deterministic ID behavior.
- Domain tests must not require database, filesystem, network, or wall clock.
