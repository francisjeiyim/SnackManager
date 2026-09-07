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
- **Phase 2 — NestJS API** (`packages/server`): done. Prisma schema + migration + seed, feature
  modules (auth, users, settings, rooms, seats, products, guests, tickets, payments, audit),
  REST with Zod validation, JWT + 3-role guard, Socket.IO `/service` gateway, `AllExceptionsFilter`
  mapping `BillingError` → 409. Full seat-in → order → close → merge → split → pay flow covered by
  9 e2e tests against a real Postgres. Endpoint reference in [`docs/API.md`](docs/API.md).
- **Phase 3 — React PWA** (`packages/app`): done. Vite + React + Router + Tailwind, `vite-plugin-pwa`,
  `react-i18next` (ja default / en). `SnackRepository` interface with an `HttpRepository` adapter
  (fetch + JWT refresh) and a Socket.IO subscription that invalidates TanStack Query caches.
  Screens: login, service board (live floor plan, seat colours, chronometers), ticket panel
  (live per-guest timers + charges, POS grid, void, close, merge, split, pay), products admin,
  invoices history + detail, settings (mode / server URL / billing / locale / staff). Whole
  login → seat-in → order → close → pay → invoices flow verified in-browser.
- **Next — Phase 4**: graphical room-layout editor (drag / resize / rotate seats, permanent vs
  dynamic, multi-room), then Phase 5 standalone (in-browser SQLite) mode.

Full plan in `docs/` and the approved plan file.
