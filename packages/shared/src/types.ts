import type {
  AssignmentEndReason,
  AuditAction,
  Currency,
  ExtensionKind,
  GuestStatus,
  Locale,
  PaymentMethod,
  SeatKind,
  SeatShape,
  StaffPresence,
  TicketStatus,
  TimeRounding,
  UserRole,
} from "./enums.js";

/** ISO-8601 timestamp string (e.g. `2026-09-07T12:34:56.000Z`). */
export type IsoDateTime = string;

/** Any instant the billing engine will accept. */
export type Instant = Date | IsoDateTime | number;

/** Integer amount of Japanese yen. No minor units. */
export type Yen = number;

// ---------------------------------------------------------------------------
// Persistent entities (mirror `packages/server/prisma/schema.prisma`)
// ---------------------------------------------------------------------------

export interface Settings {
  id: string;
  currency: Currency;
  defaultRatePerMinuteYen: Yen;
  graceMinutes: number;
  minChargeMinutes: number;
  timeRounding: TimeRounding;
  /** Length of one full set, in minutes (the first set is always charged whole). */
  setMinutes: number;
  /** Price of the first full set. */
  setPriceYen: Yen;
  /** Price of each extension half-set (`setMinutes / 2`). */
  halfSetPriceYen: Yen;
  /** Play a chime at each set / half-set boundary. */
  soundAlertsEnabled: boolean;
  defaultLocale: Locale;
  /** Hour (0–23, local) at which the "service day" rolls over for ticket numbering. */
  serviceDayCutoverHour: number;
  /**
   * The duration-alert interval in minutes (e.g. 60 → alert around each full
   * hour; 45 → every 45 min). `0` disables the alert.
   */
  hourWarningIntervalMinutes: number;
  /**
   * How many minutes before each interval boundary an occupied seat starts
   * blinking on the board (e.g. interval 60 + lead 10 → blink 50→60, 110→120).
   * `0` disables the alert.
   */
  hourWarningMinutes: number;
  /** Seconds between repeats of the end-of-set alarm (0 = play once). */
  soundRepeatSeconds: number;
  updatedAt: IsoDateTime;
}

export interface Room {
  id: string;
  name: string;
  width: number;
  height: number;
  background: string | null;
  sortOrder: number;
}

export interface Seat {
  id: string;
  roomId: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotationDeg: number;
  shape: SeatShape;
  color: string | null;
  kind: SeatKind;
  isActive: boolean;
  /** Temporary floor position for the current service; null → use x/y. */
  tempX: number | null;
  tempY: number | null;
}

export interface Party {
  id: string;
  label: string | null;
  arrivalAt: IsoDateTime;
  createdAt: IsoDateTime;
}

export interface Guest {
  id: string;
  seatId: string;
  roomId: string;
  partyId: string | null;
  displayName: string | null;
  arrivalAt: IsoDateTime;
  closedAt: IsoDateTime | null;
  ratePerMinuteYenSnapshot: Yen;
  billedMinutes: number | null;
  timeChargeYen: Yen | null;
  ticketId: string | null;
  status: GuestStatus;
  /** Pricing snapshotted at seat-in (0 → fall back to current Settings). */
  setMinutesSnapshot: number;
  setPriceYenSnapshot: Yen;
  halfSetPriceYenSnapshot: Yen;
  /** @deprecated — replaced by typed {@link GuestExtension} blocks. */
  validatedHalfSets: number;
  /** Aggregates of the validated extension blocks (derived, not columns). */
  extensionMinutes: number;
  extensionYen: Yen;
  extensionSets: number;
  extensionHalfSets: number;
  /** Derived from the seat (not persisted on the guest). */
  seatLabel?: string | null;
  /** Active staff assignment, if any (derived, not persisted on the guest). */
  assignment?: GuestAssignmentBrief | null;
}

/** The current staff↔guest assignment as shown on the board / ticket panel. */
export interface GuestAssignmentBrief {
  id: string;
  userId: string;
  staffName: string;
  assignedAt: IsoDateTime;
}

/** One staff↔guest assignment row. Closed rows (`endedAt` set) are history. */
export interface GuestAssignment {
  id: string;
  guestId: string;
  userId: string;
  assignedByUserId: string | null;
  assignedAt: IsoDateTime;
  endedAt: IsoDateTime | null;
  endedReason: AssignmentEndReason | null;
}

export interface Product {
  id: string;
  name: string;
  category: string | null;
  priceYen: Yen;
  isActive: boolean;
  sortOrder: number;
  color: string | null;
  emoji: string | null;
}

export interface Ticket {
  id: string;
  number: number;
  serviceDay: string;
  status: TicketStatus;
  openedAt: IsoDateTime;
  closedAt: IsoDateTime | null;
  paidAt: IsoDateTime | null;
  notes: string | null;
  discountYen: Yen;
  timeYen: Yen;
  productsYen: Yen;
  totalYen: Yen;
  paidYen: Yen;
  splitFromTicketId: string | null;
  mergedIntoTicketId: string | null;
}

export interface TicketItem {
  id: string;
  ticketId: string;
  productId: string | null;
  nameSnapshot: string;
  unitPriceYen: Yen;
  quantity: number;
  guestId: string | null;
  addedAt: IsoDateTime;
  addedByUserId: string | null;
  voided: boolean;
}

export interface Payment {
  id: string;
  ticketId: string;
  amountYen: Yen;
  method: PaymentMethod;
  paidAt: IsoDateTime;
  receivedByUserId: string | null;
  reference: string | null;
}

export interface PublicUser {
  id: string;
  username: string;
  displayName: string | null;
  role: UserRole;
  /** Free-text job (e.g. "Serveuse", "Cuisine"), distinct from the app role. */
  jobTitle: string | null;
  isActive: boolean;
  /** On-the-floor status, set by an admin. */
  presence: StaffPresence;
  presenceChangedAt: IsoDateTime | null;
  createdAt: IsoDateTime;
}

export interface AuditLogEntry {
  id: string;
  at: IsoDateTime;
  userId: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  dataJson: unknown;
}

// ---------------------------------------------------------------------------
// Billing engine value objects
// ---------------------------------------------------------------------------

/** The subset of {@link Settings} the billing engine reads. */
export interface BillingSettings {
  graceMinutes: number;
  setMinutes: number;
  setPriceYen: Yen;
  halfSetPriceYen: Yen;
  /** Legacy per-minute fields — kept for type compatibility, unused by set billing. */
  defaultRatePerMinuteYen?: Yen;
  minChargeMinutes?: number;
  timeRounding?: TimeRounding;
}

export interface GuestExtension {
  id: string;
  guestId: string;
  kind: ExtensionKind;
  minutes: number;
  priceYen: Yen;
  validatedAt: IsoDateTime;
  validatedByUserId: string | null;
}

export interface GuestCharge {
  guestId: string;
  billedMinutes: number;
  timeChargeYen: Yen;
  /** 0 before the grace period elapses, 1 afterwards. */
  sets: number;
  /** Validated full-set extensions. */
  extensionSets: number;
  /** Validated half-set extensions. */
  extensionHalfSets: number;
  /** Minute-mark the paid time (set + validated extensions) runs out. */
  paidUntilMinutes: number;
  /** Minutes the guest has sat past their paid time (0 → nothing owed). */
  overdueMinutes: number;
}

export interface TicketTotals {
  ticketId: string;
  timeYen: Yen;
  productsYen: Yen;
  discountYen: Yen;
  totalYen: Yen;
  perGuest: GuestCharge[];
}

/** A ticket plus the guests it bills and its product lines. */
export interface TicketBundle {
  ticket: Ticket;
  guests: Guest[];
  items: TicketItem[];
}

export interface MergePlan {
  targetTicketId: string;
  reassignGuestIds: string[];
  reassignItemIds: string[];
  voidTicketIds: string[];
  totals: TicketTotals;
}

export interface ItemizedSplitPlan {
  mode: "ITEMIZED";
  originTicketId: string;
  newTicketId: string;
  moveGuestIds: string[];
  moveItemIds: string[];
  originTotals: TicketTotals;
  newTotals: TicketTotals;
}

export interface EvenSplitPlan {
  mode: "EVEN";
  ticketId: string;
  parts: number;
  /** Integer yen shares, `length === parts`, summing exactly to {@link total}. */
  shares: Yen[];
  total: Yen;
}

export interface GroupedSplitPlan {
  mode: "GROUPS";
  originTicketId: string;
  /** One entry per group. Group 0 keeps the origin ticket; the rest are new. */
  groups: Array<{
    ticketId: string;
    guestIds: string[];
    itemIds: string[];
    totals: TicketTotals;
  }>;
}

export type SplitPlan = ItemizedSplitPlan | EvenSplitPlan | GroupedSplitPlan;

export interface ClosePlan {
  ticketId: string;
  closedAt: IsoDateTime;
  guests: Array<{
    guestId: string;
    closedAt: IsoDateTime;
    billedMinutes: number;
    timeChargeYen: Yen;
    /** Extension block to create for this guest before freezing (overdue cover). */
    appendExtension: { kind: ExtensionKind; minutes: number; priceYen: Yen } | null;
  }>;
  freeSeatIds: string[];
  totals: TicketTotals;
}
