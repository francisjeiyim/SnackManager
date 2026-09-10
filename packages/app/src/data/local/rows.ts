import type {
  BillingSettings,
  Guest,
  GuestAssignment,
  Payment,
  Product,
  PublicUser,
  Room,
  Seat,
  Settings,
  Ticket,
  TicketItem,
} from "@snackmanager/shared";

type Row = Record<string, unknown>;

const bool = (v: unknown): boolean => v === 1 || v === true;
const s = (v: unknown): string => (v == null ? "" : String(v));
const sn = (v: unknown): string | null => (v == null ? null : String(v));
const n = (v: unknown): number => Number(v ?? 0);
const nn = (v: unknown): number | null => (v == null ? null : Number(v));

export const toSettings = (r: Row): Settings => ({
  id: s(r.id),
  currency: s(r.currency) as Settings["currency"],
  defaultRatePerMinuteYen: n(r.defaultRatePerMinuteYen),
  graceMinutes: n(r.graceMinutes),
  minChargeMinutes: n(r.minChargeMinutes),
  timeRounding: s(r.timeRounding) as Settings["timeRounding"],
  setMinutes: n(r.setMinutes),
  setPriceYen: n(r.setPriceYen),
  halfSetPriceYen: n(r.halfSetPriceYen),
  soundAlertsEnabled: bool(r.soundAlertsEnabled),
  defaultLocale: s(r.defaultLocale) as Settings["defaultLocale"],
  serviceDayCutoverHour: n(r.serviceDayCutoverHour),
  hourWarningIntervalMinutes: n(r.hourWarningIntervalMinutes),
  hourWarningMinutes: n(r.hourWarningMinutes),
  updatedAt: s(r.updatedAt),
});

export const toBillingSettings = (r: Row): BillingSettings => ({
  graceMinutes: n(r.graceMinutes),
  setMinutes: n(r.setMinutes),
  setPriceYen: n(r.setPriceYen),
  halfSetPriceYen: n(r.halfSetPriceYen),
  defaultRatePerMinuteYen: n(r.defaultRatePerMinuteYen),
  minChargeMinutes: n(r.minChargeMinutes),
  timeRounding: s(r.timeRounding) as BillingSettings["timeRounding"],
});

export const toRoom = (r: Row): Room => ({
  id: s(r.id),
  name: s(r.name),
  width: n(r.width),
  height: n(r.height),
  background: sn(r.background),
  sortOrder: n(r.sortOrder),
});

export const toSeat = (r: Row): Seat => ({
  id: s(r.id),
  roomId: s(r.roomId),
  label: s(r.label),
  x: n(r.x),
  y: n(r.y),
  w: n(r.w),
  h: n(r.h),
  rotationDeg: n(r.rotationDeg),
  shape: s(r.shape) as Seat["shape"],
  color: sn(r.color),
  kind: s(r.kind) as Seat["kind"],
  isActive: bool(r.isActive),
});

export const toProduct = (r: Row): Product => ({
  id: s(r.id),
  name: s(r.name),
  category: sn(r.category),
  priceYen: n(r.priceYen),
  isActive: bool(r.isActive),
  sortOrder: n(r.sortOrder),
  color: sn(r.color),
  emoji: sn(r.emoji),
});

export const toGuest = (r: Row): Guest => ({
  id: s(r.id),
  seatId: s(r.seatId),
  roomId: s(r.roomId),
  partyId: sn(r.partyId),
  displayName: sn(r.displayName),
  arrivalAt: s(r.arrivalAt),
  closedAt: sn(r.closedAt),
  ratePerMinuteYenSnapshot: n(r.ratePerMinuteYenSnapshot),
  setMinutesSnapshot: n(r.setMinutesSnapshot),
  setPriceYenSnapshot: n(r.setPriceYenSnapshot),
  halfSetPriceYenSnapshot: n(r.halfSetPriceYenSnapshot),
  billedMinutes: nn(r.billedMinutes),
  timeChargeYen: nn(r.timeChargeYen),
  ticketId: sn(r.ticketId),
  status: s(r.status) as Guest["status"],
  seatLabel: sn(r.seatLabel),
  assignment:
    r.assignmentId == null
      ? null
      : {
          id: s(r.assignmentId),
          userId: s(r.assignmentUserId),
          staffName: s(r.assignmentStaffName),
          assignedAt: s(r.assignmentAssignedAt),
        },
});

export const toItem = (r: Row): TicketItem => ({
  id: s(r.id),
  ticketId: s(r.ticketId),
  productId: sn(r.productId),
  nameSnapshot: s(r.nameSnapshot),
  unitPriceYen: n(r.unitPriceYen),
  quantity: n(r.quantity),
  guestId: sn(r.guestId),
  addedAt: s(r.addedAt),
  addedByUserId: sn(r.addedByUserId),
  voided: bool(r.voided),
});

export const toTicket = (r: Row): Ticket => ({
  id: s(r.id),
  number: n(r.number),
  serviceDay: s(r.serviceDay),
  status: s(r.status) as Ticket["status"],
  openedAt: s(r.openedAt),
  closedAt: sn(r.closedAt),
  paidAt: sn(r.paidAt),
  notes: sn(r.notes),
  discountYen: n(r.discountYen),
  timeYen: n(r.timeYen),
  productsYen: n(r.productsYen),
  totalYen: n(r.totalYen),
  paidYen: n(r.paidYen),
  splitFromTicketId: sn(r.splitFromTicketId),
  mergedIntoTicketId: sn(r.mergedIntoTicketId),
});

export const toPayment = (r: Row): Payment => ({
  id: s(r.id),
  ticketId: s(r.ticketId),
  amountYen: n(r.amountYen),
  method: s(r.method) as Payment["method"],
  paidAt: s(r.paidAt),
  receivedByUserId: sn(r.receivedByUserId),
  reference: sn(r.reference),
});

export const toUser = (r: Row): PublicUser => ({
  id: s(r.id),
  username: s(r.username),
  displayName: sn(r.displayName),
  jobTitle: sn(r.jobTitle),
  role: s(r.role) as PublicUser["role"],
  isActive: bool(r.isActive),
  presence: (s(r.presence) || "ABSENT") as PublicUser["presence"],
  presenceChangedAt: sn(r.presenceChangedAt),
  createdAt: s(r.createdAt),
});

export const toGuestAssignment = (r: Row): GuestAssignment => ({
  id: s(r.id),
  guestId: s(r.guestId),
  userId: s(r.userId),
  assignedByUserId: sn(r.assignedByUserId),
  assignedAt: s(r.assignedAt),
  endedAt: sn(r.endedAt),
  endedReason: (sn(r.endedReason) as GuestAssignment["endedReason"]) ?? null,
});
