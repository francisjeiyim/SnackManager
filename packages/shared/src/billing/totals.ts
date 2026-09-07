import { sumYen } from "../money.js";
import type {
  BillingSettings,
  Instant,
  TicketBundle,
  TicketItem,
  TicketTotals,
  Yen,
} from "../types.js";
import { computeGuestCharge } from "./charge.js";

/** Line total for a single non-voided item. Voided items contribute 0. */
export function itemLineYen(item: TicketItem): Yen {
  return item.voided ? 0 : item.unitPriceYen * item.quantity;
}

/**
 * Recompute a ticket's totals from its guests and items.
 *
 * `now` is only used for guests whose chronometer is still running (open
 * ticket); closed guests use their frozen snapshots.
 */
export function computeTicketTotals(
  bundle: TicketBundle,
  settings: BillingSettings,
  now: Instant,
): TicketTotals {
  const perGuest = bundle.guests.map((g) => computeGuestCharge(g, settings, now));
  const timeYen = sumYen(perGuest.map((p) => p.timeChargeYen));
  const productsYen = sumYen(bundle.items.map(itemLineYen));
  const discountYen = bundle.ticket.discountYen ?? 0;
  return {
    ticketId: bundle.ticket.id,
    timeYen,
    productsYen,
    discountYen,
    totalYen: timeYen + productsYen - discountYen,
    perGuest,
  };
}
