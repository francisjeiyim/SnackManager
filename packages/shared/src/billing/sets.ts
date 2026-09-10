import { assertInteger } from "../money.js";
import { elapsedMinutesExact } from "../time.js";
import type { Instant, Yen } from "../types.js";

export interface SetPricing {
  /** Length of one full set, in minutes. */
  setMinutes: number;
  /** Price of the first full set. */
  setPriceYen: Yen;
  /** Price of each extension half-set (`setMinutes / 2`). */
  halfSetPriceYen: Yen;
  /** Below this many minutes of stay, nothing is charged. */
  graceMinutes: number;
}

export interface SetCharge {
  /** 0 while within the grace window, 1 once the first set applies. */
  sets: number;
  /** Extension half-sets past the first full set. */
  halfSets: number;
  /** Whole elapsed minutes, for display. */
  billedMinutes: number;
  timeChargeYen: Yen;
}

/**
 * Time charge for one stay, billed in sets and half-sets:
 *
 * - `elapsed <= graceMinutes` → nothing.
 * - Otherwise the **first set is always charged whole** (`setPriceYen`), even a
 *   two-minute stay past the grace window.
 * - Every started block of `setMinutes / 2` beyond the first set adds one
 *   half-set (`halfSetPriceYen`). So with a 90-min set: ≤90 → 1 set,
 *   90–135 → 1 set + 1 half, 135–180 → 1 set + 2 halves, …
 */
export function computeSetCharge(
  arrivalAt: Instant,
  endAt: Instant,
  pricing: SetPricing,
): SetCharge {
  assertInteger(pricing.setPriceYen, "setPriceYen");
  assertInteger(pricing.halfSetPriceYen, "halfSetPriceYen");

  const elapsed = elapsedMinutesExact(arrivalAt, endAt);
  const grace = Math.max(0, pricing.graceMinutes);
  if (elapsed <= grace) {
    return { sets: 0, halfSets: 0, billedMinutes: 0, timeChargeYen: 0 };
  }

  const setMinutes = Math.max(1, pricing.setMinutes);
  const half = setMinutes / 2;
  const halfSets =
    elapsed <= setMinutes ? 0 : Math.ceil((elapsed - setMinutes) / half);

  return {
    sets: 1,
    halfSets,
    billedMinutes: Math.ceil(elapsed),
    timeChargeYen: pricing.setPriceYen + halfSets * pricing.halfSetPriceYen,
  };
}
