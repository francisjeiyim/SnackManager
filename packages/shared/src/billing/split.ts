import { TicketStatus } from "../enums.js";
import { splitEven } from "../money.js";
import type {
  BillingSettings,
  EvenSplitPlan,
  Instant,
  ItemizedSplitPlan,
  TicketBundle,
} from "../types.js";
import { computeTicketTotals } from "./totals.js";
import { BillingError } from "./errors.js";

export interface ItemizedSplitInput {
  mode: "ITEMIZED";
  newTicketId: string;
  /** Guests to move to the new ticket. */
  guestIds: string[];
  /** Items to move to the new ticket. */
  itemIds: string[];
}

export interface EvenSplitInput {
  mode: "EVEN";
  parts: number;
}

export type SplitInput = ItemizedSplitInput | EvenSplitInput;

/** Divide `origin`'s current total into `parts` equal payment shares. */
export function planEvenSplit(
  origin: TicketBundle,
  input: EvenSplitInput,
  settings: BillingSettings,
  now: Instant,
): EvenSplitPlan {
  if (input.parts < 2) {
    throw new BillingError("an even split needs at least 2 parts", "BAD_PARTS");
  }
  const total = computeTicketTotals(origin, settings, now).totalYen;
  return {
    mode: "EVEN",
    ticketId: origin.ticket.id,
    parts: input.parts,
    shares: splitEven(total, input.parts),
    total,
  };
}

/** Move the selected guests and items onto a brand-new ticket. */
export function planItemizedSplit(
  origin: TicketBundle,
  input: ItemizedSplitInput,
  settings: BillingSettings,
  now: Instant,
): ItemizedSplitPlan {
  if (origin.ticket.status !== TicketStatus.OPEN) {
    throw new BillingError(
      `ticket ${origin.ticket.id} is ${origin.ticket.status}, cannot split`,
      "TICKET_NOT_OPEN",
    );
  }
  const moveGuestIds = new Set(input.guestIds);
  const moveItemIds = new Set(input.itemIds);

  for (const id of moveGuestIds) {
    if (!origin.guests.some((g) => g.id === id)) {
      throw new BillingError(
        `guest ${id} is not on ticket ${origin.ticket.id}`,
        "GUEST_NOT_ON_TICKET",
      );
    }
  }
  for (const id of moveItemIds) {
    if (!origin.items.some((it) => it.id === id)) {
      throw new BillingError(
        `item ${id} is not on ticket ${origin.ticket.id}`,
        "ITEM_NOT_ON_TICKET",
      );
    }
  }
  if (moveGuestIds.size === 0 && moveItemIds.size === 0) {
    throw new BillingError("nothing selected to split off", "EMPTY_SPLIT");
  }
  if (moveGuestIds.size === origin.guests.length && moveItemIds.size === origin.items.length) {
    throw new BillingError("split would move the entire ticket", "FULL_SPLIT");
  }

  const moved: TicketBundle = {
    ticket: { ...origin.ticket, id: input.newTicketId, discountYen: 0 },
    guests: origin.guests.filter((g) => moveGuestIds.has(g.id)),
    items: origin.items.filter((it) => moveItemIds.has(it.id)),
  };
  const remaining: TicketBundle = {
    ticket: origin.ticket,
    guests: origin.guests.filter((g) => !moveGuestIds.has(g.id)),
    items: origin.items.filter((it) => !moveItemIds.has(it.id)),
  };

  return {
    mode: "ITEMIZED",
    originTicketId: origin.ticket.id,
    newTicketId: input.newTicketId,
    moveGuestIds: [...moveGuestIds],
    moveItemIds: [...moveItemIds],
    originTotals: computeTicketTotals(remaining, settings, now),
    newTotals: computeTicketTotals(moved, settings, now),
  };
}

export function planSplit(
  origin: TicketBundle,
  input: SplitInput,
  settings: BillingSettings,
  now: Instant,
): ItemizedSplitPlan | EvenSplitPlan {
  return input.mode === "EVEN"
    ? planEvenSplit(origin, input, settings, now)
    : planItemizedSplit(origin, input, settings, now);
}
