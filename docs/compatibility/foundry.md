# Foundry VTT Compatibility

Foundry content is an external import source, not a runtime dependency or domain model.

## Supported approach

- A source adapter reads an explicitly supported Foundry generation/system/module range.
- Adapter output is normalized input consumed by `converter-core`.
- Converter output is versioned VTT IR plus stable diagnostics.
- Import preview identifies converted, approximated, ignored, and unsupported data.

## Mapping policy

- Preserve source identity in namespaced metadata for traceability and deterministic IDs.
- Map portable concepts such as scenes, actors, tokens, journals, assets, walls, and folders.
- Route game-system fields through a matching ruleset adapter; never leak them into VTT-neutral domain types.
- Preserve unknown safe JSON in bounded extension fields when lossless mapping is impossible.
- Never execute macros, scripts, HTML event handlers, package code, or migrations from imported content.

## Assets and archives

Reject absolute/parent paths, links, encrypted entries, executable formats, excessive nesting, and declared/expanded size limit violations. Content-address imported assets and record missing assets as diagnostics.

## Version matrix

Support must be declared by source generation, system ID/version range, adapter version, and IR version. Unknown combinations fail closed. Fixtures must be synthetic or distributable and include expected diagnostics. No claim of full Foundry compatibility is implied.
