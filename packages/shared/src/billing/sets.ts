import { assertInteger } from "../money.js";
import { elapsedMinutesExact } from "../time.js";
import type { Instant, Yen } from "../types.js";

export interface SetPricing {
  /** Length of one full set, in minutes. */
  setMinutes: number;
  /** Price of the first full set. */
  setPriceYen: Yen;
  /** Price of a half-set extension (`setMinutes / 2`). */
  halfSetPriceYen: Yen;
  /** Below this many minutes of stay, nothing is charged. */
  graceMinutes: number;
  /** Total minutes covered by validated extension blocks. */
  extensionMinutes?: number;
  /** Total yen of validated extension blocks. */
  extensionYen?: Yen;
  extensionSets?: number;
  extensionHalfSets?: number;
}

export interface SetCharge {
  sets: number;
  extensionSets: number;
  extensionHalfSets: number;
  /** Minute-mark the paid time runs out (set + validated extensions). */
  paidUntilMinutes: number;
  /** Minutes sat past the paid time (0 → nothing owed). */
  overdueMinutes: number;
  /** Whole elapsed minutes, for display. */
  billedMinutes: number;
  timeChargeYen: Yen;
}

/**
 * Time charge for one stay:
 *
 * - `elapsed <= graceMinutes` → nothing.
 * - Otherwise the first set is charged whole (`setPriceYen`), plus every
 *   extension block an operator has **validated** (a full set or a half-set).
 * - Extensions the operator has not validated are *not* billed; the guest is
 *   simply "overdue" by `elapsed - paidUntil` minutes.
 */
export function computeSetCharge(
  arrivalAt: Instant,
  endAt: Instant,
  pricing: SetPricing,
): SetCharge {
  assertInteger(pricing.setPriceYen, "setPriceYen");

  const elapsed = elapsedMinutesExact(arrivalAt, endAt);
  const grace = Math.max(0, pricing.graceMinutes);
  const extMinutes = Math.max(0, pricing.extensionMinutes ?? 0);
  const extYen = Math.max(0, pricing.extensionYen ?? 0);
  const extSets = pricing.extensionSets ?? 0;
  const extHalfSets = pricing.extensionHalfSets ?? 0;

  if (elapsed <= grace) {
    return {
      sets: 0,
      extensionSets: extSets,
      extensionHalfSets: extHalfSets,
      paidUntilMinutes: 0,
      overdueMinutes: 0,
      billedMinutes: 0,
      timeChargeYen: 0,
    };
  }

  const setMinutes = Math.max(1, pricing.setMinutes);
  const paidUntilMinutes = setMinutes + extMinutes;
  const billedMinutes = Math.ceil(elapsed);

  return {
    sets: 1,
    extensionSets: extSets,
    extensionHalfSets: extHalfSets,
    paidUntilMinutes,
    overdueMinutes: Math.max(0, billedMinutes - paidUntilMinutes),
    billedMinutes,
    timeChargeYen: pricing.setPriceYen + extYen,
  };
}
