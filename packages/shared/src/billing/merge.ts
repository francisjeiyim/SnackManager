import { TicketStatus } from "../enums.js";
import type { BillingSettings, Instant, MergePlan, TicketBundle } from "../types.js";
import { computeTicketTotals } from "./totals.js";
import { BillingError } from "./errors.js";

/**
 * Plan the merge of several open tickets into one.
 *
 * Every guest and item from `sources` is reassigned to `target`; the emptied
 * source tickets are marked to be voided (`mergedIntoTicketId = target.id`).
 * All tickets must be OPEN. Pure — the caller persists the result.
 */
export function planMerge(
  target: TicketBundle,
  sources: TicketBundle[],
  settings: BillingSettings,
  now: Instant,
): MergePlan {
  const all = [target, ...sources];
  const seen = new Set<string>();
  for (const b of all) {
    if (b.ticket.status !== TicketStatus.OPEN) {
      throw new BillingError(
        `ticket ${b.ticket.id} is ${b.ticket.status}, only OPEN tickets can be merged`,
        "TICKET_NOT_OPEN",
      );
    }
    if (seen.has(b.ticket.id)) {
      throw new BillingError(`ticket ${b.ticket.id} listed twice in merge`, "DUPLICATE_TICKET");
    }
    seen.add(b.ticket.id);
  }
  if (sources.length === 0) {
    throw new BillingError("merge needs at least one source ticket", "NO_SOURCES");
  }

  const reassignGuestIds = sources.flatMap((s) => s.guests.map((g) => g.id));
  const reassignItemIds = sources.flatMap((s) => s.items.map((it) => it.id));

  const merged: TicketBundle = {
    ticket: target.ticket,
    guests: [...target.guests, ...sources.flatMap((s) => s.guests)],
    items: [...target.items, ...sources.flatMap((s) => s.items)],
  };

  return {
    targetTicketId: target.ticket.id,
    reassignGuestIds,
    reassignItemIds,
    voidTicketIds: sources.map((s) => s.ticket.id),
    totals: computeTicketTotals(merged, settings, now),
  };
}
