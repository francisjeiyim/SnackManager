import type { Seat } from "@snackmanager/shared";

/** A seat being edited on the canvas — same shape as {@link Seat}. */
export type SeatDraft = Seat;

export type SeatGeometryPatch = Partial<
  Pick<
    Seat,
    "x" | "y" | "w" | "h" | "rotationDeg" | "label" | "shape" | "kind" | "color" | "isActive"
  >
>;
