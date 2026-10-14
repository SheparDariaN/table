# Table VTT

Greenfield virtual tabletop built as a TypeScript modular monolith.

## Quick start

Requirements: Node.js 22+, Corepack, Git, Docker Desktop for the container stack.
JavaScript packages are currently downloaded from `https://registry.npmjs.org`.
The GitVerse npm mirror remains available for a later connectivity test.

```powershell
corepack install
corepack pnpm install
Copy-Item .env.example .env
corepack pnpm verify
docker compose up --build
```

The web application is available at `http://localhost:8080`. For native
development, set `DATABASE_URL` to a reachable PostgreSQL instance and run
`corepack pnpm dev`.

Convert or inspect a Roll20 export:

```powershell
corepack pnpm build
node apps/converter-cli/dist/index.js inspect character.json
node apps/converter-cli/dist/index.js convert character.json --output actor.json --report report.json
```

The same conversion is exposed as
`POST /v1/conversions/roll20-foundry?strict=false`. The optional licensed
Foundry smoke contract is documented in `tests/foundry-smoke/README.md`.

## Product scope

- Browser client renders maps, tokens, fog, and overlays with PixiJS.
- API owns commands, authorization, persistence, and authoritative realtime state.
- PostgreSQL is the durable source of truth.
- Converter imports external content through a pure, versioned intermediate representation (IR).
- Rulesets are isolated behind explicit domain ports.

## Repository map

- `apps/web` — browser UI and rendering adapters.
- `apps/api` — HTTP/WebSocket composition root and application adapters.
- `packages/domain` — framework-free domain model, commands, events, and ports.
- `packages/converter-core` — pure source-to-IR conversion.
- `infra` — local and deployment infrastructure.
- `docs` — architecture, ADRs, compatibility, security, and testing guidance.

## Architectural invariants

1. Clients submit intent; the server validates and publishes canonical state.
2. Domain code does not import UI, transport, database, or vendor SDKs.
3. Durable state is committed to PostgreSQL before success is acknowledged.
4. Public contracts are versioned and backward-compatible within their support window.
5. Conversion is deterministic: identical normalized input yields identical IR and IDs.

Read `AGENTS.md` before making changes. More specific `AGENTS.md` files and `.cursor/rules` apply by path.
