# Deployment modes

The app runs in one of two modes, chosen in **Settings** (persisted in
`localStorage`, overridable at build time by `VITE_DEFAULT_MODE`).

## Autonomous (offline)

- All data lives in an **in-browser SQLite database** (`@sqlite.org/sqlite-wasm`).
  Persistence tier, chosen automatically at startup:
  1. **OPFS** sync-access-handle pool — unlimited, survives reloads (modern
     Chrome / Edge / Safari 17+).
  2. **`localStorage`** (kvvfs) — a few MB, survives reloads (older / embedded
     browsers without sync access handles).
  3. **in-memory** — last resort, lost on reload; Settings shows a warning.
- No server, no network, no login screen — a single implicit local `ADMIN`.
- Multiple tabs on the same device stay in sync via `BroadcastChannel`.
- Backup / restore = export / import the `.sqlite3` file from Settings (import
  needs the OPFS tier); "Reset" wipes local data.
- `packages/app/src/data/local/schema.sql` mirrors the Prisma schema; a parity
  test fails the build if they drift.

## Client / server

- Data lives in **PostgreSQL** behind the NestJS API.
- Multiple devices (till + servers' tablets) share one live view; the room plan,
  chronometers and tickets update in real time over **Socket.IO**.
- Staff authenticate (JWT) with one of three roles: `ADMIN`, `CASHIER`, `SERVER`.
- Set the server URL in Settings; the app stores tokens and reconnects the socket
  automatically.

## Switching

Switching mode swaps the active `SnackRepository` implementation at runtime. Data
does **not** migrate automatically between SQLite and PostgreSQL — export/import
or a future sync tool is required.
