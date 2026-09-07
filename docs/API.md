# REST API (server mode)

Base path `/api`. All routes require a Bearer JWT except those marked _public_.
Bodies are validated with the Zod schemas from `@snackmanager/shared`.
Role column: minimum role (ADMIN always allowed).

## Auth

| Method | Path            | Role   | Notes                                                            |
| ------ | --------------- | ------ | ---------------------------------------------------------------- |
| POST   | `/auth/login`   | public | `{ username, password }` → `{ user, accessToken, refreshToken }` |
| POST   | `/auth/refresh` | public | `{ refreshToken }` → new token pair (old refresh revoked)        |
| POST   | `/auth/logout`  | public | `{ refreshToken }`                                               |
| GET    | `/auth/me`      | any    | current user                                                     |
| GET    | `/health`       | public | `{ status, db }`                                                 |

## Settings / users

| Method | Path                | Role  |
| ------ | ------------------- | ----- |
| GET    | `/settings`         | any   |
| PUT    | `/settings`         | ADMIN |
| GET    | `/users`            | ADMIN |
| POST   | `/users`            | ADMIN |
| PATCH  | `/users/:id/active` | ADMIN |

## Rooms, seats, products

| Method | Path              | Role  | Notes                                                                    |
| ------ | ----------------- | ----- | ------------------------------------------------------------------------ |
| GET    | `/rooms`          | any   | rooms with their seats                                                   |
| GET    | `/rooms/:id`      | any   |                                                                          |
| POST   | `/rooms`          | ADMIN |                                                                          |
| PATCH  | `/rooms/:id`      | ADMIN |                                                                          |
| DELETE | `/rooms/:id`      | ADMIN |                                                                          |
| POST   | `/seats`          | ADMIN |                                                                          |
| PATCH  | `/seats/bulk`     | ADMIN | `{ roomId, seats: [{ id, ...geometry }] }` — one call per editor gesture |
| PATCH  | `/seats/:id`      | ADMIN |                                                                          |
| DELETE | `/seats/:id`      | ADMIN | 409 if occupied                                                          |
| GET    | `/products?all=1` | any   |                                                                          |
| POST   | `/products`       | ADMIN |                                                                          |
| PATCH  | `/products/:id`   | ADMIN |                                                                          |
| DELETE | `/products/:id`   | ADMIN | deactivates (history kept)                                               |

## Service — guests

| Method | Path                   | Role           | Notes                                                                                    |
| ------ | ---------------------- | -------------- | ---------------------------------------------------------------------------------------- |
| GET    | `/guests/active`       | SERVER/CASHIER | every seated guest                                                                       |
| POST   | `/guests/seat-in`      | SERVER/CASHIER | `SeatInInput` → `{ partyId, tickets[] }`. `separateTickets: true` = one ticket per guest |
| PATCH  | `/guests/:id/move`     | SERVER/CASHIER | `{ toSeatId }`                                                                           |
| POST   | `/guests/:id/seat-out` | SERVER/CASHIER | close one guest early                                                                    |

## Service — tickets

| Method | Path                              | Role           | Notes                                                                      |
| ------ | --------------------------------- | -------------- | -------------------------------------------------------------------------- |
| GET    | `/tickets/live`                   | any            | all OPEN tickets, with live totals                                         |
| GET    | `/tickets?status=&serviceDay=`    | any            | history                                                                    |
| GET    | `/tickets/:id`                    | any            | one ticket + `live` totals                                                 |
| POST   | `/tickets/:id/items`              | SERVER/CASHIER | `{ productId } \| { nameSnapshot, unitPriceYen }`, `quantity`, `guestId?`  |
| PATCH  | `/tickets/:id/items/:itemId/void` | SERVER/CASHIER |                                                                            |
| PATCH  | `/tickets/:id`                    | CASHIER        | `{ notes?, discountYen? }`                                                 |
| POST   | `/tickets/:id/close`              | CASHIER        | `{ closedAt? }` — stops chronometers, frees seats                          |
| POST   | `/tickets/merge`                  | CASHIER        | `{ targetTicketId, sourceTicketIds[] }`                                    |
| POST   | `/tickets/:id/split`              | CASHIER        | `{ mode: "ITEMIZED", guestIds[], itemIds[] }` or `{ mode: "EVEN", parts }` |
| GET    | `/tickets/:id/payments`           | CASHIER        |                                                                            |
| POST   | `/tickets/:id/payments`           | CASHIER        | `{ amountYen, method, reference? }` → balance; marks `PAID` when covered   |

## Real-time (Socket.IO)

Namespace `/service`. Client emits `join` / `leave` with a `Room.id`. Server
broadcasts `ServiceEvent` values (`ticket.updated`, `guest.seated`,
`guest.closed`, `ticket.merged`, `ticket.split`, `ticket.paid`, `seat.updated`,
`layout.updated`, `room.updated`, `product.updated`) after each mutation.
