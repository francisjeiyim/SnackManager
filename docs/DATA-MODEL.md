# Data model

Single restaurant. Amounts are integer yen. Timestamps are `DateTime` (ISO in transport).

| Entity                    | Key fields                                                                                                                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Settings** (single row) | `currency=JPY`, `defaultRatePerMinuteYen`, `graceMinutes=0`, `minChargeMinutes=0`, `timeRounding=CEIL_MINUTE`, `defaultLocale=ja`, `serviceDayCutoverHour`                                                   |
| **Room** (salle)          | `name`, `width`, `height`, `background`, `sortOrder`                                                                                                                                                         |
| **Seat** (place)          | `roomId`, `label`, geometry `x,y,w,h,rotationDeg`, `shape=RECT\|ROUND`, `color`, `kind=PERMANENT\|DYNAMIC`, `isActive`                                                                                       |
| **Party** (groupe)        | `label`, `arrivalAt`                                                                                                                                                                                         |
| **Guest** (client)        | `seatId`, `roomId`, `partyId?`, `displayName?`, `arrivalAt`, `closedAt?`, `ratePerMinuteYenSnapshot`, `billedMinutes?`, `timeChargeYen?`, `ticketId?`, `status=SEATED\|CLOSED`                               |
| **Ticket** (facture)      | `number`, `status=OPEN\|CLOSED\|PAID\|VOID`, `openedAt`, `closedAt?`, `paidAt?`, `notes?`, snapshots `timeYen,productsYen,discountYen,totalYen,paidYen`, lineage `splitFromTicketId?`, `mergedIntoTicketId?` |
| **TicketItem** (ligne)    | `ticketId`, `productId?`, `nameSnapshot`, `unitPriceYen`, `quantity`, `guestId?`, `addedAt`, `addedByUserId?`, `voided`                                                                                      |
| **Product**               | `name`, `category`, `priceYen`, `isActive`, `sortOrder`, `color`, `emoji`                                                                                                                                    |
| **Payment** (règlement)   | `ticketId`, `amountYen`, `method=CASH\|CARD\|MOBILE\|OTHER`, `paidAt`, `receivedByUserId?`, `reference?`                                                                                                     |
| **User** (staff)          | `username`, `passwordHash`, `displayName`, `role=ADMIN\|CASHIER\|SERVER`, `isActive`                                                                                                                         |
| **AuditLog**              | `at`, `userId?`, `action`, `entityType`, `entityId`, `dataJson`                                                                                                                                              |
| **Sequence**              | ticket-number counter (per service day)                                                                                                                                                                      |

## Roles

| Role      | Can                                                                                           |
| --------- | --------------------------------------------------------------------------------------------- |
| `ADMIN`   | everything: settings, rooms/layout, products, users, reports, plus all cashier/server actions |
| `CASHIER` | seat guests, take orders, **close / merge / split / void tickets, take payments**             |
| `SERVER`  | seat guests, take orders, add/remove items on open tickets                                    |

Autonomous mode has an implicit local `ADMIN` and an optional PIN lock.
