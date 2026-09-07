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
- **Phase 4 — room-layout editor** (`packages/app` → `/rooms`): done. Canvas with pointer-driven
  drag / resize / rotate (grid-snapped), a per-seat properties panel (label, kind PERMANENT ·
  DYNAMIC, shape, geometry, active), add permanent / dynamic seats, multi-room tabs, add room,
  room settings (name, size, background colour), delete seat / room. Local edits show an
  "unsaved" badge and persist through `PATCH /seats/bulk`; verified in-browser (move → save →
  reload keeps position; add/delete dynamic seat).
- **Phase 5 — standalone mode** (`packages/app`): done. `SqliteRepository` implements the whole
  `SnackRepository` in the browser over `@sqlite.org/sqlite-wasm` — OPFS sync-access-handle pool
  when available, `localStorage` (kvvfs) fallback, in-memory last resort. Every money/time
  calculation goes through the same `@snackmanager/shared` engine (`planClose` / `planMerge` /
  `planSplit` / `computeTicketTotals`), so an offline bill matches a server one. `schema.sql`
  mirrors `schema.prisma`, enforced by a 14-case parity test. Cross-tab updates via
  `BroadcastChannel`; first-run seed; `.sqlite3` export / import / reset in Settings; no login
  screen (implicit local admin). Verified in-browser: seat-in → order → close → pay → even split,
  and data surviving a full reload.

Full plan in `docs/` and the approved plan file. Remaining: Phase 6 — receipts, daily Z-report,
PWA icons + install docs, README polish.
