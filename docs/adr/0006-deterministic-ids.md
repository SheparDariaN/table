# ADR 0006: Deterministic Import IDs

- Status: Accepted
- Date: 2026-10-14

## Context

Imports must support previews, retries, diagnostics, references, and reproducible fixtures without creating duplicate identities.

## Decision

Imported entity IDs are derived from:

```text
id = encode(hash(algorithmVersion, namespace, sourceIdentity, entityKind))
```

Inputs use canonical UTF-8 encoding, explicit separators/lengths, normalized stable source identity, and a documented cryptographic hash. Human labels, array positions, timestamps, environment data, and mutable content are excluded. Native user-created entities use injected random ID generation instead.

Collisions fail conversion with a stable diagnostic; they are never silently reassigned. Algorithm changes require a new version and migration/reference-rewrite plan.

## Consequences

- Repeated imports and cross-references are stable.
- Renaming a source identity may intentionally create a new identity.
- Namespacing prevents unrelated sources and entity kinds from colliding.
- Golden vectors must lock canonicalization and encoding behavior across runtimes.
