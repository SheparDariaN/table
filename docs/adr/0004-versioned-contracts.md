# ADR 0004: Versioned Contracts

- Status: Accepted
- Date: 2026-10-14

## Context

HTTP payloads, realtime events, persisted payloads, converter IR, and ruleset plugins evolve at different rates and may outlive one deployment.

## Decision

Every boundary contract has an explicit version and runtime schema. Producers emit one current version; consumers either support declared versions through adapters/migrations or reject them with a stable unsupported-version error.

Changes within a version are backward-compatible and additive. Breaking semantic or structural changes require a new version, fixtures, migration/adapter strategy, support window, and removal note.

## Consequences

- Compatibility work and contract tests are required.
- Rolling deployment and stored-data evolution are safer.
- Version numbers must not be inferred from package or application versions.
- Old versions are removed deliberately, never by accidental parser breakage.
