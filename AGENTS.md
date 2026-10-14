# Agent Guide

## Scope

Applies repository-wide. A nearer `AGENTS.md` adds or overrides local guidance.

## Working agreement

- Use strict TypeScript; never use `any`, unchecked casts, or non-null assertions.
- Prefer immutable data, pure functions, discriminated unions, and explicit return types.
- Keep dependency flow inward: adapters depend on application/domain contracts, never the reverse.
- Validate all untrusted input at a boundary and return typed errors.
- Preserve authoritative-server, PostgreSQL-source-of-truth, and versioned-contract invariants.
- Add focused tests for behavior changes; test deterministic behavior without clocks, randomness, or networks.
- Do not mix refactors with feature work or introduce abstractions without a current use.

## Change workflow

1. Read the relevant architecture docs and ADRs.
2. Identify the owning module and public contract.
3. Make the smallest coherent change.
4. Run formatting, type checks, unit tests, and affected integration tests.
5. Update docs or add an ADR when changing a durable architectural decision.

## Boundaries

- Secrets, generated files, build output, and local databases are never committed.
- Public contracts require explicit versions and migration/compatibility notes.
- Cross-module access uses exported APIs, commands, events, or ports—not internal imports.
- Never log tokens, credentials, private chat, hidden map data, or raw user uploads.

See `docs/architecture/overview.md`, `docs/testing.md`, and `docs/security.md`.
