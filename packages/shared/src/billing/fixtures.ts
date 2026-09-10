import { GuestStatus, TicketStatus, TimeRounding } from "../enums.js";
import type { BillingSettings, Guest, Ticket, TicketBundle, TicketItem } from "../types.js";

export const T0 = "2026-09-07T12:00:00.000Z";

/** `T0 + n` minutes as an ISO string. */
export function at(minutes: number): string {
  return new Date(Date.parse(T0) + minutes * 60_000).toISOString();
}

export function settings(overrides: Partial<BillingSettings> = {}): BillingSettings {
  return {
    graceMinutes: 0,
    setMinutes: 90,
    setPriceYen: 2000,
    halfSetPriceYen: 1000,
    defaultRatePerMinuteYen: 10,
    minChargeMinutes: 0,
    timeRounding: TimeRounding.CEIL_MINUTE,
    ...overrides,
  };
}

let seq = 0;
const nextId = (prefix: string): string => `${prefix}_${++seq}`;

export function guest(overrides: Partial<Guest> = {}): Guest {
  const id = overrides.id ?? nextId("g");
  return {
    id,
    seatId: overrides.seatId ?? `seat_${id}`,
    roomId: "room_1",
    partyId: null,
    displayName: null,
    arrivalAt: T0,
    closedAt: null,
    ratePerMinuteYenSnapshot: 10,
    setMinutesSnapshot: 90,
    setPriceYenSnapshot: 2000,
    halfSetPriceYenSnapshot: 1000,
    validatedHalfSets: 0,
    billedMinutes: null,
    timeChargeYen: null,
    ticketId: "t_1",
    status: GuestStatus.SEATED,
    ...overrides,
  };
}

export function item(overrides: Partial<TicketItem> = {}): TicketItem {
  const id = overrides.id ?? nextId("i");
  return {
    id,
    ticketId: overrides.ticketId ?? "t_1",
    productId: null,
    nameSnapshot: "Coffee",
    unitPriceYen: 300,
    quantity: 1,
    guestId: null,
    addedAt: T0,
    addedByUserId: null,
    voided: false,
    ...overrides,
  };
}

export function ticket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: "t_1",
    number: 1,
    serviceDay: "2026-09-07",
    status: TicketStatus.OPEN,
    openedAt: T0,
    closedAt: null,
    paidAt: null,
    notes: null,
    discountYen: 0,
    timeYen: 0,
    productsYen: 0,
    totalYen: 0,
    paidYen: 0,
    splitFromTicketId: null,
    mergedIntoTicketId: null,
    ...overrides,
  };
}

export function bundle(overrides: Partial<TicketBundle> = {}): TicketBundle {
  return {
    ticket: ticket(),
    guests: [],
    items: [],
    ...overrides,
  };
}
