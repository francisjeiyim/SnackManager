import { TicketStatus } from "../enums.js";
import { splitEven } from "../money.js";
import type {
  BillingSettings,
  EvenSplitPlan,
  GroupedSplitPlan,
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

export interface GroupedSplitInput {
  mode: "GROUPS";
  /** Guest ids partitioned into groups. */
  groups: string[][];
  /** Ids for the tickets of groups 1..n (group 0 keeps the origin ticket). */
  newTicketIds: string[];
}

export type SplitInput = ItemizedSplitInput | EvenSplitInput | GroupedSplitInput;

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

/**
 * Partition the ticket's guests into groups. Group 0 keeps the origin ticket;
 * each other group becomes a new ticket carrying its guests and the items
 * attributed to those guests. Unattributed (shared) items stay on group 0.
 */
export function planGroupedSplit(
  origin: TicketBundle,
  input: GroupedSplitInput,
  settings: BillingSettings,
  now: Instant,
): GroupedSplitPlan {
  if (origin.ticket.status !== TicketStatus.OPEN) {
    throw new BillingError(
      `ticket ${origin.ticket.id} is ${origin.ticket.status}, cannot split`,
      "TICKET_NOT_OPEN",
    );
  }
  if (input.groups.length < 2) {
    throw new BillingError("a grouped split needs at least 2 groups", "BAD_GROUPS");
  }
  if (input.newTicketIds.length < input.groups.length - 1) {
    throw new BillingError("not enough ticket ids for the groups", "BAD_GROUPS");
  }

  const ticketGuestIds = new Set(origin.guests.map((g) => g.id));
  const assigned = new Set<string>();
  for (const group of input.groups) {
    if (group.length === 0) {
      throw new BillingError("a group is empty", "EMPTY_GROUP");
    }
    for (const gid of group) {
      if (!ticketGuestIds.has(gid)) {
        throw new BillingError(
          `guest ${gid} is not on ticket ${origin.ticket.id}`,
          "GUEST_NOT_ON_TICKET",
        );
      }
      if (assigned.has(gid)) {
        throw new BillingError(`guest ${gid} is in more than one group`, "GUEST_IN_TWO_GROUPS");
      }
      assigned.add(gid);
    }
  }
  if (assigned.size !== ticketGuestIds.size) {
    throw new BillingError("every guest must be assigned to a group", "GUEST_UNASSIGNED");
  }
  if (input.groups.some((g) => g.length === origin.guests.length)) {
    throw new BillingError("one group holds every guest — nothing to split", "FULL_GROUP");
  }

  const groups = input.groups.map((guestIdList, index) => {
    const guestSet = new Set(guestIdList);
    const ticketId = index === 0 ? origin.ticket.id : input.newTicketIds[index - 1]!;
    // Items follow their guest; shared items (no guestId) stay on group 0.
    const items = origin.items.filter((it) =>
      it.guestId != null ? guestSet.has(it.guestId) : index === 0,
    );
    const bundle: TicketBundle = {
      ticket: {
        ...origin.ticket,
        id: ticketId,
        discountYen: index === 0 ? origin.ticket.discountYen : 0,
      },
      guests: origin.guests.filter((g) => guestSet.has(g.id)),
      items,
    };
    return {
      ticketId,
      guestIds: [...guestSet],
      itemIds: items.map((it) => it.id),
      totals: computeTicketTotals(bundle, settings, now),
    };
  });

  return { mode: "GROUPS", originTicketId: origin.ticket.id, groups };
}

export function planSplit(
  origin: TicketBundle,
  input: SplitInput,
  settings: BillingSettings,
  now: Instant,
): ItemizedSplitPlan | EvenSplitPlan | GroupedSplitPlan {
  if (input.mode === "EVEN") return planEvenSplit(origin, input, settings, now);
  if (input.mode === "GROUPS") return planGroupedSplit(origin, input, settings, now);
  return planItemizedSplit(origin, input, settings, now);
}
