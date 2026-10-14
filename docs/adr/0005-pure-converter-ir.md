# ADR 0005: Pure Converter and IR

- Status: Accepted
- Date: 2026-10-14

## Context

External VTT formats are unstable, partially trusted, and tied to filesystem/archive concerns. Mapping them directly into persistence couples vendors, security risks, and domain writes.

## Decision

Source adapters perform bounded I/O and produce normalized input. `converter-core` is a pure pipeline that returns versioned canonical IR plus diagnostics. A separate authorized application step validates and applies IR to the domain.

The converter does not access filesystem, network, database, current time, randomness, locale, or process environment. Expected source problems are diagnostics, not exceptions.

## Consequences

- Conversion is repeatable, previewable, and golden-testable.
- Source decoding, semantic conversion, and domain application can evolve independently.
- IR schemas and migrations become maintained public contracts.
- The pipeline has additional stages, but failures are isolated and explainable.
