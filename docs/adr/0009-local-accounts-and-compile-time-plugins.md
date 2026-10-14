# ADR 0009: Local Accounts and Compile-time Plugins

- Status: Accepted
- Date: 2026-10-14

## Context

The first UI release needs GM/Player/Admin access control and extension points before realtime play or third-party code exists.

## Decision

Accounts are local. Passwords use Argon2id. Session tokens are stored only as SHA-256 hashes in HttpOnly cookies. Roles are `admin`, `gm`, and `player`, enforced on every API action.

UI extensions are trusted compile-time manifests validated before startup. The contract version is `1.0.0`. Plugins contribute navigation, routes, and named slots. They cannot load remote code or import feature internals. A sandbox for untrusted plugins requires a future ADR.

## Consequences

- Bootstrap admin credentials are required and must not use known placeholders in production.
- CSRF tokens protect cookie-authenticated mutations. Login accepts any browser origin so the UI can be opened on any host and port.
- Plugin registries fail closed on duplicate IDs, routes, or invalid manifests.
- Hidden scene data is not part of this plugin contract.
