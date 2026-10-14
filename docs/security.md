# Security

## Trust boundaries

Browser input, HTTP/WS payloads, uploads, imported packages, ruleset implementations, environment variables, and database contents are untrusted at their boundaries. Parse with explicit schemas and reject unsupported versions.

## Controls

- Authenticate every connection; authorize every object operation server-side.
- Filter snapshots/events before transmission; hidden GM data never reaches unauthorized clients.
- Use secure, HttpOnly, SameSite cookies or short-lived scoped tokens; protect state-changing HTTP from CSRF.
- Enforce TLS, origin checks, request/upload/decompression limits, rate limits, and timeouts.
- Store passwords with a modern adaptive hash; rotate signing and database credentials.
- Use parameterized queries and least-privilege migration/runtime database roles.
- Sanitize filenames and rendered rich text; block executable content and path traversal.
- Scan archive entries before extraction; reject links, absolute paths, excessive nesting, and zip bombs.
- Run containers as non-root and keep dependencies/images pinned and scanned.

## Logging and response

Never log credentials, session tokens, private chat, raw uploads, hidden scene data, or full payloads. Log actor ID, campaign ID, command/event ID, correlation ID, outcome, and stable error code where appropriate. Keep audit events append-only for membership, role, import, and destructive actions.

Report suspected vulnerabilities privately. Preserve evidence, revoke affected credentials, scope exposure, patch, and document follow-up. Security-sensitive design changes require threat-model notes and an ADR when durable.
