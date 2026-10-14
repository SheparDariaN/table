# ADR 0001: Modular Monolith

- Status: Accepted
- Date: 2026-10-14

## Context

The VTT needs strong domain boundaries and transactional workflows, while an early product benefits from simple deployment and operation.

## Decision

Build one API deployable as a modular monolith. Modules own application operations, domain logic, persistence access, and public contracts. Cross-module interaction uses exported commands, queries, events, or ports; internal imports and cross-module table writes are forbidden.

The web client and pure shared packages remain separate build units. Module boundaries must be enforceable with import rules and tests.

## Consequences

- Cross-module transactions and local calls remain possible.
- Deployment, observability, and debugging stay simple.
- Poor discipline could create a distributed-looking big ball of mud, so public entry points and ownership are mandatory.
- A module may later be extracted only when measured scaling, isolation, or ownership needs justify the operational cost.
