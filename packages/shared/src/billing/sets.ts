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
  /** Extension half-sets an operator has validated (default 0). */
  validatedHalfSets?: number;
}

export interface SetCharge {
  /** 0 while within the grace window, 1 once the first set applies. */
  sets: number;
  /** Extension half-sets actually billed (validated, capped at consumed). */
  halfSets: number;
  /** Extension half-sets elapsed by the clock. */
  consumedHalfSets: number;
  /** Whole elapsed minutes, for display. */
  billedMinutes: number;
  timeChargeYen: Yen;
}

/**
 * Time charge for one stay, billed in sets and half-sets:
 *
 * - `elapsed <= graceMinutes` → nothing.
 * - Otherwise the **first set is always charged whole** (`setPriceYen`).
 * - Every started block of `setMinutes / 2` beyond the first set is *consumed*;
 *   but only the half-sets an operator has **validated** are billed
 *   (`validatedHalfSets`, capped at what has actually been consumed).
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
    return { sets: 0, halfSets: 0, consumedHalfSets: 0, billedMinutes: 0, timeChargeYen: 0 };
  }

  const setMinutes = Math.max(1, pricing.setMinutes);
  const half = setMinutes / 2;
  const consumedHalfSets =
    elapsed <= setMinutes ? 0 : Math.ceil((elapsed - setMinutes) / half);
  const billedHalfSets = Math.max(
    0,
    Math.min(pricing.validatedHalfSets ?? 0, consumedHalfSets),
  );

  return {
    sets: 1,
    halfSets: billedHalfSets,
    consumedHalfSets,
    billedMinutes: Math.ceil(elapsed),
    timeChargeYen: pricing.setPriceYen + billedHalfSets * pricing.halfSetPriceYen,
  };
}
