import { z } from "zod";
import { Locale, PaymentMethod, SeatKind, SeatShape, TimeRounding, UserRole } from "./enums.js";

const yen = z.number().int();
const positiveInt = z.number().int().positive();
const nonNegInt = z.number().int().nonnegative();
const id = z.string().min(1);

export const localeSchema = z.nativeEnum(Locale);
export const paymentMethodSchema = z.nativeEnum(PaymentMethod);
export const userRoleSchema = z.nativeEnum(UserRole);

// --- Settings ---------------------------------------------------------------

export const settingsUpdateSchema = z.object({
  defaultRatePerMinuteYen: yen.nonnegative().optional(),
  graceMinutes: nonNegInt.optional(),
  minChargeMinutes: nonNegInt.optional(),
  timeRounding: z.nativeEnum(TimeRounding).optional(),
  defaultLocale: localeSchema.optional(),
  serviceDayCutoverHour: z.number().int().min(0).max(23).optional(),
});
export type SettingsUpdateInput = z.infer<typeof settingsUpdateSchema>;

// --- Rooms & seats --------------------------------------------------------

export const roomInputSchema = z.object({
  name: z.string().min(1).max(80),
  width: positiveInt,
  height: positiveInt,
  background: z.string().max(2048).nullable().optional(),
  sortOrder: z.number().int().optional(),
});
export type RoomInput = z.infer<typeof roomInputSchema>;

export const seatGeometrySchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
  rotationDeg: z.number(),
});

export const seatInputSchema = seatGeometrySchema.extend({
  roomId: id,
  label: z.string().min(1).max(24),
  shape: z.nativeEnum(SeatShape).default(SeatShape.RECT),
  color: z.string().max(32).nullable().optional(),
  kind: z.nativeEnum(SeatKind).default(SeatKind.PERMANENT),
  isActive: z.boolean().default(true),
});
export type SeatInput = z.infer<typeof seatInputSchema>;

export const seatPatchSchema = seatInputSchema.partial().omit({ roomId: true });
export type SeatPatch = z.infer<typeof seatPatchSchema>;

// --- Products -----------------------------------------------------------

export const productInputSchema = z.object({
  name: z.string().min(1).max(80),
  category: z.string().max(40).nullable().optional(),
  priceYen: yen.nonnegative(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().optional(),
  color: z.string().max(32).nullable().optional(),
  emoji: z.string().max(8).nullable().optional(),
});
export type ProductInput = z.infer<typeof productInputSchema>;

// --- Seating (guests / parties) ---------------------------------------

export const seatInSchema = z.object({
  roomId: id,
  /** One entry per guest to seat; a seat may host several guests. */
  guests: z
    .array(
      z.object({
        seatId: id,
        displayName: z.string().min(1).max(40).nullable().optional(),
      }),
    )
    .min(1),
  /** Attach to this existing party; omit to create a new one. */
  partyId: id.nullable().optional(),
  partyLabel: z.string().min(1).max(40).nullable().optional(),
  /** Defaults to server clock. Accepts an explicit arrival for backdating. */
  arrivalAt: z.string().datetime().optional(),
});
export type SeatInInput = z.infer<typeof seatInSchema>;

export const moveGuestSchema = z.object({
  guestId: id,
  toSeatId: id,
});
export type MoveGuestInput = z.infer<typeof moveGuestSchema>;

// --- Ticket lines -----------------------------------------------------

export const addItemSchema = z.object({
  ticketId: id,
  productId: id.nullable().optional(),
  nameSnapshot: z.string().min(1).max(80).optional(),
  unitPriceYen: yen.nonnegative().optional(),
  quantity: positiveInt.default(1),
  guestId: id.nullable().optional(),
});
export type AddItemInput = z.infer<typeof addItemSchema>;

// --- Merge / split / close / pay ------------------------------------

export const mergeSchema = z.object({
  targetTicketId: id,
  sourceTicketIds: z.array(id).min(1),
});
export type MergeInput = z.infer<typeof mergeSchema>;

export const splitSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("ITEMIZED"),
    ticketId: id,
    guestIds: z.array(id).default([]),
    itemIds: z.array(id).default([]),
  }),
  z.object({
    mode: z.literal("EVEN"),
    ticketId: id,
    parts: positiveInt.min(2),
  }),
]);
export type SplitInputDto = z.infer<typeof splitSchema>;

export const closeTicketSchema = z.object({
  ticketId: id,
  closedAt: z.string().datetime().optional(),
});
export type CloseTicketInput = z.infer<typeof closeTicketSchema>;

export const paymentSchema = z.object({
  ticketId: id,
  amountYen: yen.positive(),
  method: paymentMethodSchema,
  reference: z.string().max(120).nullable().optional(),
});
export type PaymentInput = z.infer<typeof paymentSchema>;

// --- Auth (server mode) ---------------------------------------------

export const loginSchema = z.object({
  username: z.string().min(1).max(60),
  password: z.string().min(1).max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const userCreateSchema = z.object({
  username: z.string().min(1).max(60),
  password: z.string().min(8).max(200),
  displayName: z.string().min(1).max(80).nullable().optional(),
  role: userRoleSchema,
});
export type UserCreateInput = z.infer<typeof userCreateSchema>;
