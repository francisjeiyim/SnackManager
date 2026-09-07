# SnackManager

Fast client/server billing for a restaurant, billing each guest on **time spent
(per minute)** plus **products consumed**. Flexible graphical room plan; bills can
be merged and split. Runs as an installable **PWA** on Windows, Android and iOS,
**client/server** (real-time, multi-device) or **fully offline**.

## Packages

| Path              | What                                                                       |
| ----------------- | -------------------------------------------------------------------------- |
| `packages/shared` | Pure domain core: types, Zod schemas, money/time helpers, billing engine.  |
| `packages/server` | NestJS + Prisma + PostgreSQL API + Socket.IO gateway (client/server mode). |
| `packages/app`    | Vite + React PWA — the UI, both modes.                                     |

See [`docs/`](docs) for architecture, data model, billing rules and modes.

## Prerequisites

- Node ≥ 20, pnpm 11
- Docker (only for client/server mode: PostgreSQL)

## Setup

```bash
pnpm install
cp .env.example .env
```

## Develop

```bash
# client/server mode
docker compose up -d postgres
pnpm --filter @snackmanager/server prisma:migrate   # after Phase 2 lands
pnpm --filter @snackmanager/server seed
pnpm dev                                            # server + app via Turbo
```

App: http://localhost:5273 — API: http://localhost:4100/api — Adminer: http://localhost:8082

## Test / lint / build

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

## Status

- **Phase 0 — scaffold**: done. pnpm/Turbo workspace, three packages, tooling, CI, docker-compose, docs.
- **Phase 1 — billing engine** (`packages/shared`): done. Enums, domain types, Zod schemas,
  money/time helpers and the pure billing engine (billed minutes, time charge, ticket totals,
  close, merge, itemized + even split) with 50 unit tests.
- **Next — Phase 2**: NestJS API (Prisma schema, modules, REST, Zod validation, JWT + roles,
  Socket.IO gateway, seed, e2e tests).

Full plan in `docs/` and the approved plan file.
