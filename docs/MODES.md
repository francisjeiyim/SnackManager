# Deployment modes

The app runs in one of two modes, chosen in **Settings** (persisted in
`localStorage`, overridable at build time by `VITE_DEFAULT_MODE`).

## Autonomous (offline)

- All data lives in an **in-browser SQLite database** (`wa-sqlite`, persisted to
  OPFS). No server, no network.
- Multiple tabs on the same device stay in sync via `BroadcastChannel`.
- Backup / restore = export / import the `.sqlite3` file from Settings.
- Implicit local `ADMIN`; optional PIN lock on launch.
- Fully usable as an installed PWA with no connectivity.

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
