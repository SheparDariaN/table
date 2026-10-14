# ADR 0003: PostgreSQL as Source of Truth

- Status: Accepted
- Date: 2026-10-14

## Context

Campaign data requires durable transactions, constraints, concurrency control, querying, backup, and recovery.

## Decision

PostgreSQL is the durable source of truth. State changes and outbox records commit atomically. Caches, search indexes, object storage metadata projections, and client state are rebuildable and cannot establish permissions or successful writes.

Modules own their tables and migration paths. Database access uses parameterized queries, explicit transactions, constraints, and optimistic revisions. Production backup restoration is tested.

## Consequences

- Correctness relies on PostgreSQL semantics and is integration-tested against PostgreSQL.
- Runtime availability depends on the database for authoritative operations.
- Schema changes require backward-compatible deployment sequencing.
- Derived stores may improve reads but must document rebuild and staleness behavior.
