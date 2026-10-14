# Testing Strategy

## Test pyramid

- **Unit:** pure domain rules, reducers, selectors, geometry, contract parsing, and conversion.
- **Integration:** PostgreSQL adapters/transactions, migrations, outbox, HTTP/WS delivery, and source adapters.
- **Contract:** fixtures for every supported HTTP, event, persisted payload, IR, and ruleset version.
- **End-to-end:** critical user journeys only: join campaign, load scene, move token, reconnect, import content.

## Required properties

- Tests are deterministic: inject clocks/IDs; freeze locale/timezone; avoid shared mutable fixtures.
- Assert behavior and public contracts, not private implementation.
- Every defect fix includes the smallest regression test at the lowest useful layer.
- PostgreSQL behavior is tested against PostgreSQL, not an in-memory substitute.
- Concurrency tests cover duplicate command IDs, stale revisions, transaction rollback, and outbox retries.
- Realtime tests cover duplication, ordering gaps, reconnect, snapshot replacement, and authorization changes.
- Converter golden tests normalize formatting and prove repeated runs emit equivalent IR.

## Test data

Use builders with safe defaults and explicit overrides. Fixtures must contain no production data, secrets, copyrighted source packages, or personal information.

## CI gates

Run formatting, lint, strict type checks, unit tests, affected integration/contract tests, migration validation, and dependency/image scanning. Keep flaky tests visible and fix or quarantine with an owner and expiry.
