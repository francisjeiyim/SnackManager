# Billing rules

A guest's bill has two parts: **time** and **products**.

## Time charge (per guest)

When a guest takes a seat, `arrivalAt` is recorded. When their ticket is closed,
`closedAt` is set. The billable minutes are derived as:

```
raw      = ceilOrFloor((closedAt - arrivalAt) / 60_000)   # whole minutes
afterGrace = max(0, raw - settings.graceMinutes)
rounded  = applyRounding(afterGrace, settings.timeRounding)
billedMinutes = max(rounded, settings.minChargeMinutes)
timeChargeYen = billedMinutes * guest.ratePerMinuteYenSnapshot
```

- `settings.graceMinutes` — free minutes at the start (default `0`).
- `settings.minChargeMinutes` — floor on billed minutes (default `0`).
- `settings.timeRounding` — `NONE` | `CEIL_MINUTE` (default) | `CEIL_5MIN`.
- The **rate is snapshotted onto the guest at seat-in** (`ratePerMinuteYenSnapshot`),
  so later changes to `settings.defaultRatePerMinuteYen` never rewrite history.
- For an **open** ticket the engine computes a live estimate using `now`; for a
  **closed** ticket it reads the stored snapshots.

## Ticket total

```
timeYen     = Σ guest.timeChargeYen        (over guests on the ticket)
productsYen  = Σ item.unitPriceYen * item.quantity   (non-voided items)
totalYen     = timeYen + productsYen - discountYen
```

## Merge

`mergeTickets(sources[], target)` — reassigns every guest and item from the
source tickets onto `target`, then recomputes. All tickets must be `OPEN` and
belong to the same restaurant. Sources become `mergedIntoTicketId = target.id`
and status `VOID` for audit lineage.

## Split

- **Itemized** — pick guests and/or specific items; they move to a brand-new
  ticket (`splitFromTicketId = origin.id`). Both tickets are recomputed.
- **Even** — `totalYen` is divided into N equal shares; the remainder (at most
  N-1 yen) is added to the last share. Produces N payment shares against the one
  ticket (no line-level detail).

## Closing

Closing a ticket sets `closedAt = now` on the ticket and on every `SEATED` guest
it bills (stopping their chronometers), computes and stores all snapshots, frees
the seats, and moves the ticket to `CLOSED`. Payments then move it to `PAID`.
