/**
 * Domain enums as `const` objects (string unions). Prisma declares matching
 * native enums; values are byte-for-byte identical so they cross the wire and
 * the SQLite mirror unchanged.
 */

export const Currency = {
  JPY: "JPY",
} as const;
export type Currency = (typeof Currency)[keyof typeof Currency];

export const Locale = {
  ja: "ja",
  en: "en",
} as const;
export type Locale = (typeof Locale)[keyof typeof Locale];

export const DeploymentMode = {
  AUTONOMOUS: "AUTONOMOUS",
  SERVER: "SERVER",
} as const;
export type DeploymentMode = (typeof DeploymentMode)[keyof typeof DeploymentMode];

/** How raw elapsed minutes are rounded before billing. */
export const TimeRounding = {
  /** Truncate to whole completed minutes. */
  NONE: "NONE",
  /** Round up to the next whole minute (default). */
  CEIL_MINUTE: "CEIL_MINUTE",
  /** Round up to the next multiple of 5 minutes. */
  CEIL_5MIN: "CEIL_5MIN",
} as const;
export type TimeRounding = (typeof TimeRounding)[keyof typeof TimeRounding];

export const SeatKind = {
  /** Fixed seat, part of the room's baseline layout. */
  PERMANENT: "PERMANENT",
  /** Ad-hoc seat added for a rush; typically removed afterwards. */
  DYNAMIC: "DYNAMIC",
} as const;
export type SeatKind = (typeof SeatKind)[keyof typeof SeatKind];

export const SeatShape = {
  RECT: "RECT",
  ROUND: "ROUND",
} as const;
export type SeatShape = (typeof SeatShape)[keyof typeof SeatShape];

export const GuestStatus = {
  /** Chronometer running. */
  SEATED: "SEATED",
  /** Chronometer stopped at `closedAt`; charge snapshots frozen. */
  CLOSED: "CLOSED",
} as const;
export type GuestStatus = (typeof GuestStatus)[keyof typeof GuestStatus];

export const TicketStatus = {
  OPEN: "OPEN",
  CLOSED: "CLOSED",
  PAID: "PAID",
  VOID: "VOID",
} as const;
export type TicketStatus = (typeof TicketStatus)[keyof typeof TicketStatus];

export const PaymentMethod = {
  CASH: "CASH",
  CARD: "CARD",
  MOBILE: "MOBILE",
  OTHER: "OTHER",
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const UserRole = {
  ADMIN: "ADMIN",
  CASHIER: "CASHIER",
  SERVER: "SERVER",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const SplitMode = {
  /** Move chosen guests/items onto a new ticket. */
  ITEMIZED: "ITEMIZED",
  /** Divide the total into N equal payment shares. */
  EVEN: "EVEN",
} as const;
export type SplitMode = (typeof SplitMode)[keyof typeof SplitMode];

export const AuditAction = {
  SEAT_IN: "SEAT_IN",
  SEAT_OUT: "SEAT_OUT",
  TICKET_OPEN: "TICKET_OPEN",
  TICKET_ADD_ITEM: "TICKET_ADD_ITEM",
  TICKET_VOID_ITEM: "TICKET_VOID_ITEM",
  TICKET_PATCH: "TICKET_PATCH",
  TICKET_CLOSE: "TICKET_CLOSE",
  TICKET_MERGE: "TICKET_MERGE",
  TICKET_SPLIT: "TICKET_SPLIT",
  TICKET_VOID: "TICKET_VOID",
  PAYMENT: "PAYMENT",
  SEAT_CREATE: "SEAT_CREATE",
  LAYOUT_EDIT: "LAYOUT_EDIT",
  PRODUCT_EDIT: "PRODUCT_EDIT",
  SETTINGS_EDIT: "SETTINGS_EDIT",
} as const;
export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

/** Socket.IO event names broadcast on the `/service` namespace. */
export const ServiceEvent = {
  SEAT_UPDATED: "seat.updated",
  GUEST_SEATED: "guest.seated",
  GUEST_CLOSED: "guest.closed",
  PARTY_UPDATED: "party.updated",
  TICKET_UPDATED: "ticket.updated",
  TICKET_MERGED: "ticket.merged",
  TICKET_SPLIT: "ticket.split",
  TICKET_PAID: "ticket.paid",
  PRODUCT_UPDATED: "product.updated",
  ROOM_UPDATED: "room.updated",
  LAYOUT_UPDATED: "layout.updated",
} as const;
export type ServiceEvent = (typeof ServiceEvent)[keyof typeof ServiceEvent];
