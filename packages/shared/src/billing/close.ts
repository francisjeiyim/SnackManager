import { GuestStatus, TicketStatus } from "../enums.js";
import { toDate } from "../time.js";
import type { BillingSettings, ClosePlan, Instant, TicketBundle } from "../types.js";
import { computeGuestCharge } from "./charge.js";
import { computeTicketTotals } from "./totals.js";
import { BillingError } from "./errors.js";

/**
 * Plan the closing of a ticket: freeze every still-seated guest at `now`,
 * compute their final snapshots, list the seats to free, and return the final
 * totals. Pure — the caller persists the result.
 */
export function planClose(
  bundle: TicketBundle,
  settings: BillingSettings,
  now: Instant,
  opts: { billConsumed?: boolean } = {},
): ClosePlan {
  if (bundle.ticket.status !== TicketStatus.OPEN) {
    throw new BillingError(
      `ticket ${bundle.ticket.id} is ${bundle.ticket.status}, cannot close`,
      "TICKET_NOT_OPEN",
    );
  }
  const closedAt = toDate(now).toISOString();
  // Default: closing bills every half-set actually consumed, regardless of what
  // was validated during the service.
  const billConsumed = opts.billConsumed ?? true;

  const guests = bundle.guests
    .filter((g) => g.status === GuestStatus.SEATED)
    .map((g) => {
      const consumed = computeGuestCharge({ ...g, closedAt: null }, settings, closedAt)
        .consumedHalfSets;
      const validatedHalfSets = billConsumed
        ? consumed
        : Math.min(g.validatedHalfSets ?? 0, consumed);
      const charge = computeGuestCharge(
        { ...g, closedAt: null, validatedHalfSets },
        settings,
        closedAt,
      );
      return {
        guestId: g.id,
        closedAt,
        billedMinutes: charge.billedMinutes,
        timeChargeYen: charge.timeChargeYen,
        validatedHalfSets,
      };
    });

  // Totals computed as if every guest were already frozen at closedAt.
  const frozenBundle: TicketBundle = {
    ...bundle,
    guests: bundle.guests.map((g) => {
      if (g.status !== GuestStatus.SEATED) return g;
      const snap = guests.find((x) => x.guestId === g.id);
      return snap
        ? {
            ...g,
            status: GuestStatus.CLOSED,
            closedAt: snap.closedAt,
            billedMinutes: snap.billedMinutes,
            timeChargeYen: snap.timeChargeYen,
            validatedHalfSets: snap.validatedHalfSets,
          }
        : g;
    }),
  };

  return {
    ticketId: bundle.ticket.id,
    closedAt,
    guests,
    freeSeatIds: guests
      .map((g) => bundle.guests.find((x) => x.id === g.guestId)?.seatId)
      .filter((id): id is string => id != null),
    totals: computeTicketTotals(frozenBundle, settings, closedAt),
  };
}
