import { ExtensionKind, GuestStatus, TicketStatus } from "../enums.js";
import { toDate } from "../time.js";
import type { BillingSettings, ClosePlan, Guest, Instant, TicketBundle } from "../types.js";
import { computeGuestCharge } from "./charge.js";
import { computeTicketTotals } from "./totals.js";
import { BillingError } from "./errors.js";

type OverdueExtension = "SET" | "HALF" | "NONE" | null;

/** The extension block that would cover a guest's overdue time, priced from its snapshot. */
function overdueBlock(
  guest: Guest,
  settings: BillingSettings,
  kind: "SET" | "HALF",
): { kind: ExtensionKind; minutes: number; priceYen: number } {
  const setMinutes = guest.setMinutesSnapshot || settings.setMinutes;
  return kind === "SET"
    ? {
        kind: ExtensionKind.SET,
        minutes: setMinutes,
        priceYen: guest.setPriceYenSnapshot || settings.setPriceYen,
      }
    : {
        kind: ExtensionKind.HALF,
        minutes: Math.round(setMinutes / 2),
        priceYen: guest.halfSetPriceYenSnapshot || settings.halfSetPriceYen,
      };
}

/**
 * Plan the closing of a ticket. `opts.overdueExtension` decides what to do with
 * guests whose paid time has run out: add a full-set or half-set block to cover
 * it, or leave it (bill only what was validated).
 */
export function planClose(
  bundle: TicketBundle,
  settings: BillingSettings,
  now: Instant,
  opts: { overdueExtension?: OverdueExtension } = {},
): ClosePlan {
  if (bundle.ticket.status !== TicketStatus.OPEN) {
    throw new BillingError(
      `ticket ${bundle.ticket.id} is ${bundle.ticket.status}, cannot close`,
      "TICKET_NOT_OPEN",
    );
  }
  const closedAt = toDate(now).toISOString();
  const cover =
    opts.overdueExtension === "SET" || opts.overdueExtension === "HALF"
      ? opts.overdueExtension
      : null;

  const guests = bundle.guests
    .filter((g) => g.status === GuestStatus.SEATED)
    .map((g) => {
      const base = computeGuestCharge({ ...g, closedAt: null }, settings, closedAt);
      let append: { kind: ExtensionKind; minutes: number; priceYen: number } | null = null;
      let effective: Guest = g;

      if (base.overdueMinutes > 0 && cover) {
        append = overdueBlock(g, settings, cover);
        effective = {
          ...g,
          extensionMinutes: (g.extensionMinutes ?? 0) + append.minutes,
          extensionYen: (g.extensionYen ?? 0) + append.priceYen,
          extensionSets: (g.extensionSets ?? 0) + (cover === "SET" ? 1 : 0),
          extensionHalfSets: (g.extensionHalfSets ?? 0) + (cover === "HALF" ? 1 : 0),
        };
      }

      const charge = computeGuestCharge({ ...effective, closedAt: null }, settings, closedAt);
      return {
        guestId: g.id,
        closedAt,
        billedMinutes: charge.billedMinutes,
        timeChargeYen: charge.timeChargeYen,
        appendExtension: append,
      };
    });

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
