# Infrastructure Agent Guide

## Responsibility

Reproducible local, CI, and deployment infrastructure.

## Rules

- Pin image versions and toolchains; avoid floating tags.
- Run application containers as non-root with read-only filesystems where practical.
- Keep secrets in runtime secret stores or ignored environment files, never images or manifests.
- Expose only required ports; keep PostgreSQL private by default.
- Add health checks that reflect readiness without leaking internals.
- Use least-privilege database roles and separate migration/runtime credentials.
- Make schema migrations forward-safe, observable, and separately executable.
- Set CPU, memory, log, restart, and shutdown behavior explicitly.
- Keep development defaults non-production and document every production override.

## Verification

- Validate configuration syntax and image builds in CI.
- Scan images and dependencies; fail on actionable high/critical findings.
- Test backup restoration and graceful shutdown periodically.
