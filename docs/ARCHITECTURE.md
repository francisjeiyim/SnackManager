# Architecture

SnackManager is a pnpm/Turbo monorepo with three packages:

| Package                | Role                                                                                                                   |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `@snackmanager/shared` | Pure domain core — types, Zod schemas, money/time helpers, **billing engine**. Zero I/O. Runs in Node and the browser. |
| `@snackmanager/server` | NestJS 10 + Prisma 5 + PostgreSQL. REST API + Socket.IO gateway. Used only in **client/server mode**.                  |
| `@snackmanager/app`    | Vite + React SPA, installable **PWA**. The only UI. Works in both modes.                                               |

## One billing core, two data sources

The UI never talks to a database directly. It depends on a `SnackRepository`
interface (`packages/app/src/data/repository.ts`) with two implementations:

- **`HttpRepository`** — talks to the NestJS API over REST and subscribes to
  Socket.IO events (`/service` namespace). This is _client/server mode_.
- **`SqliteRepository`** — an in-browser SQLite database (`wa-sqlite` persisted
  to OPFS). Cross-tab updates via `BroadcastChannel`. This is _autonomous
  (offline) mode_.

Both implementations call the **same pure functions** in `@snackmanager/shared`
for every money and time calculation, so a bill computed offline is identical to
one computed on the server.

Prisma cannot run in the browser, so the SQLite schema is maintained by hand in
`packages/app/src/data/local/schema.sql` and a parity test asserts its tables and
columns match `packages/server/prisma/schema.prisma`.

## Real-time

`EventsGateway` (Socket.IO, namespace `/service`, one room per `Room.id`).
Services emit after each mutation: `seat.updated`, `guest.seated`,
`guest.closed`, `party.updated`, `ticket.updated`, `ticket.merged`,
`ticket.split`, `ticket.paid`, `product.updated`, `room.updated`,
`layout.updated`. The client invalidates / patches its TanStack Query cache;
falls back to polling if the socket drops.

## Money & locale

- Currency **JPY**, no minor units — every amount is an integer number of yen
  (`*Yen` fields). Money helpers in `shared/src/money.ts` keep arithmetic in
  integers and distribute rounding remainders deterministically.
- UI languages: **Japanese (default)** and **English**, via `react-i18next`.
  API error messages via `nestjs-i18n` (`en`, `ja`).
