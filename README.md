# SnackManager

Fast billing for a restaurant that charges each guest on **time spent (per
minute)** plus **products consumed**. Graphical room plan, group or individual
tickets, bills that **merge** and **split**. Installable **PWA** for Windows,
Android and iOS, running **client/server** (real-time, multi-device) or **fully
offline**.

## Packages

| Path              | What                                                                       |
| ----------------- | -------------------------------------------------------------------------- |
| `packages/shared` | Pure domain core: types, Zod schemas, money/time helpers, billing engine.  |
| `packages/server` | NestJS + Prisma + PostgreSQL API + Socket.IO gateway (client/server mode). |
| `packages/app`    | Vite + React PWA — the UI, both modes.                                     |

Docs: [ARCHITECTURE](docs/ARCHITECTURE.md) · [DATA-MODEL](docs/DATA-MODEL.md) ·
[BILLING](docs/BILLING.md) · [API](docs/API.md) · [MODES](docs/MODES.md) ·
[INSTALL](docs/INSTALL.md) · [DEPLOY](docs/DEPLOY.md)

## Features

- **Service board** — per-room floor plan from real seat geometry, colour-coded
  by state, live chronometers. Seat guests as a group or individually.
- **Ticket panel** — live per-guest elapsed time and time charge (ticking every
  second), POS product grid, void, **close** (stops chronometers, frees seats),
  **merge**, **split** (itemised or into equal shares), **pay** with change due,
  printable receipt.
- **Room-layout editor** — drag / resize / rotate seats on a canvas, permanent
  vs dynamic seats, multiple rooms, background colour.
- **Invoices** — searchable history with a detail view and receipt reprint.
- **Daily Z-report** — revenue, time vs product split, payments by method,
  average party size and stay, seat occupancy, for any service day.
- **Settings** — deployment mode, billing (rate/min, grace, minimum, rounding),
  language (日本語 / English), staff accounts, local-data backup.
- **Roles** — `ADMIN` (everything), `CASHIER` (close / merge / split / void /
  pay), `SERVER` (seat, order). Enforced by the API and reflected in the UI.

## Prerequisites

- Node ≥ 20, pnpm 11
- Docker — only for client/server mode (PostgreSQL)

## Setup

```bash
pnpm install
cp .env.example .env
cp packages/server/.env.example packages/server/.env
```

## Develop — client/server mode

```bash
docker compose up -d postgres
pnpm --filter @snackmanager/server prisma:migrate
pnpm --filter @snackmanager/server seed
pnpm dev
```

App: http://localhost:5273 · API: http://localhost:4100/api · Adminer: http://localhost:8082

Seeded logins: `admin` / `admin1234`, `caisse` / `caisse1234`, `service` / `service1234`.

## Develop — standalone (offline) mode

```bash
pnpm --filter @snackmanager/app dev
```

Open Settings → set mode to **Standalone** → reload. No server needed; the app
seeds its own in-browser SQLite database on first run.

## Deploy — test subdomain (client/server)

```bash
cp .env.prod.example .env.prod   # fill in secrets + Cloudflare Tunnel id
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

One HTTPS hostname serves the SPA, `/api` and `/socket.io` behind a dedicated
Cloudflare Tunnel. Full steps: [docs/DEPLOY.md](docs/DEPLOY.md).

## Test / lint / build

```bash
pnpm test        # shared billing engine (50) + schema parity (14)
pnpm lint
pnpm typecheck
pnpm build
pnpm --filter @snackmanager/server test:e2e   # needs Postgres; 9 flow tests
```

`pnpm gen:icons` regenerates the PWA icons.
