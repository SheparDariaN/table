# Table VTT

Greenfield virtual tabletop built as a TypeScript modular monolith.

## Quick start

Requirements: Node.js 22+, Corepack, Git, Docker Desktop for the container stack.
JavaScript packages are downloaded from the GitVerse npm mirror at `https://npm-mirror.gitverse.ru`.
There is no fallback to `registry.npmjs.org`.

```powershell
corepack install
corepack pnpm install
Copy-Item .env.example .env
corepack pnpm verify
```

Set `BOOTSTRAP_ADMIN_PASSWORD` in `.env` to a unique password of at least 12
characters before starting the stack. Compose runs the API in production mode
and refuses the placeholder values `change-me-in-production` and
`replace-this-password`. The first empty database creates that admin account.
Later starts do not reset it.

```powershell
docker compose up --build
```

Open `http://localhost:8080/login`. After signing in, the shell exposes Worlds,
Actors, Compendium, and Journal as reserved modules. Game masters and admins
can use `/tools/converter`. Admins can manage users, sessions, audit, plugins,
and system health under `/admin`.

For native development, set `DATABASE_URL` to a reachable PostgreSQL instance
and run `corepack pnpm dev`. The web client uses `http://localhost:5173`. Apply
schema changes with `corepack pnpm --filter @arcane-table/api db:migrate`.

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
