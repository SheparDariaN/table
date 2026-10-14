# Converter Core Agent Guide

## Responsibility

Pure conversion from normalized external input into versioned VTT intermediate representation (IR).

## Rules

- Keep filesystem, archive, network, database, and vendor SDK access in adapters.
- Use pipeline stages: decode → normalize → validate → map → canonicalize → emit.
- Return diagnostics with stable codes and source paths; do not throw for expected bad input.
- Preserve unknown but safe source data in namespaced extension fields.
- Generate IDs only from canonical semantic identity using the documented algorithm/version.
- Sort maps, sets, diagnostics, and emitted arrays where source order is not semantic.
- Never read current time, locale, environment, random values, or process-global state.
- Version IR schemas and migrations independently from source adapters.

## Testing

- Golden-test canonical IR and diagnostics.
- Verify byte-equivalent output across repeated runs.
- Add fixtures for missing, malformed, duplicate, and unknown source fields.
