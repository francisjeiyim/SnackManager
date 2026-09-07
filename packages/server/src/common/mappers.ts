import type {
  Guest as PGuest,
  Payment as PPayment,
  Product as PProduct,
  Room as PRoom,
  Seat as PSeat,
  Settings as PSettings,
  Ticket as PTicket,
  TicketItem as PTicketItem,
  User as PUser,
} from "@prisma/client";
import type {
  BillingSettings,
  Guest,
  Payment,
  Product,
  PublicUser,
  Room,
  Seat,
  Settings,
  Ticket,
  TicketBundle,
  TicketItem,
} from "@snackmanager/shared";

const iso = (d: Date): string => d.toISOString();
const isoOrNull = (d: Date | null): string | null => (d ? d.toISOString() : null);

export const toSettings = (r: PSettings): Settings => ({
  id: r.id,
  currency: r.currency,
  defaultRatePerMinuteYen: r.defaultRatePerMinuteYen,
  graceMinutes: r.graceMinutes,
  minChargeMinutes: r.minChargeMinutes,
  timeRounding: r.timeRounding,
  defaultLocale: r.defaultLocale,
  serviceDayCutoverHour: r.serviceDayCutoverHour,
  hourWarningIntervalMinutes: r.hourWarningIntervalMinutes,
  hourWarningMinutes: r.hourWarningMinutes,
  updatedAt: iso(r.updatedAt),
});

export const toBillingSettings = (r: PSettings): BillingSettings => ({
  defaultRatePerMinuteYen: r.defaultRatePerMinuteYen,
  graceMinutes: r.graceMinutes,
  minChargeMinutes: r.minChargeMinutes,
  timeRounding: r.timeRounding,
});

export const toRoom = (r: PRoom): Room => ({
  id: r.id,
  name: r.name,
  width: r.width,
  height: r.height,
  background: r.background,
  sortOrder: r.sortOrder,
});

export const toSeat = (r: PSeat): Seat => ({
  id: r.id,
  roomId: r.roomId,
  label: r.label,
  x: r.x,
  y: r.y,
  w: r.w,
  h: r.h,
  rotationDeg: r.rotationDeg,
  shape: r.shape,
  color: r.color,
  kind: r.kind,
  isActive: r.isActive,
});

export const toProduct = (r: PProduct): Product => ({
  id: r.id,
  name: r.name,
  category: r.category,
  priceYen: r.priceYen,
  isActive: r.isActive,
  sortOrder: r.sortOrder,
  color: r.color,
  emoji: r.emoji,
});

type PGuestWithSeat = PGuest & { seat?: { label: string } | null };

export const toGuest = (r: PGuestWithSeat): Guest => ({
  id: r.id,
  seatId: r.seatId,
  roomId: r.roomId,
  partyId: r.partyId,
  displayName: r.displayName,
  arrivalAt: iso(r.arrivalAt),
  closedAt: isoOrNull(r.closedAt),
  ratePerMinuteYenSnapshot: r.ratePerMinuteYenSnapshot,
  billedMinutes: r.billedMinutes,
  timeChargeYen: r.timeChargeYen,
  ticketId: r.ticketId,
  status: r.status,
  seatLabel: r.seat?.label ?? null,
});

export const toTicketItem = (r: PTicketItem): TicketItem => ({
  id: r.id,
  ticketId: r.ticketId,
  productId: r.productId,
  nameSnapshot: r.nameSnapshot,
  unitPriceYen: r.unitPriceYen,
  quantity: r.quantity,
  guestId: r.guestId,
  addedAt: iso(r.addedAt),
  addedByUserId: r.addedByUserId,
  voided: r.voided,
});

export const toTicket = (r: PTicket): Ticket => ({
  id: r.id,
  number: r.number,
  serviceDay: r.serviceDay,
  status: r.status,
  openedAt: iso(r.openedAt),
  closedAt: isoOrNull(r.closedAt),
  paidAt: isoOrNull(r.paidAt),
  notes: r.notes,
  discountYen: r.discountYen,
  timeYen: r.timeYen,
  productsYen: r.productsYen,
  totalYen: r.totalYen,
  paidYen: r.paidYen,
  splitFromTicketId: r.splitFromTicketId,
  mergedIntoTicketId: r.mergedIntoTicketId,
});

export const toPayment = (r: PPayment): Payment => ({
  id: r.id,
  ticketId: r.ticketId,
  amountYen: r.amountYen,
  method: r.method,
  paidAt: iso(r.paidAt),
  receivedByUserId: r.receivedByUserId,
  reference: r.reference,
});

export const toPublicUser = (r: PUser): PublicUser => ({
  id: r.id,
  username: r.username,
  displayName: r.displayName,
  role: r.role,
  isActive: r.isActive,
  createdAt: iso(r.createdAt),
});

/** Assemble the {@link TicketBundle} the billing engine consumes. */
export const toBundle = (
  ticket: PTicket,
  guests: PGuestWithSeat[],
  items: PTicketItem[],
): TicketBundle => ({
  ticket: toTicket(ticket),
  guests: guests.map(toGuest),
  items: items.map(toTicketItem),
});
