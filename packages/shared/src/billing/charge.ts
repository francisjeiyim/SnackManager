import { GuestStatus } from "../enums.js";
import { assertInteger } from "../money.js";
import type { BillingSettings, Guest, GuestCharge, Instant, Yen } from "../types.js";
import { computeSetCharge } from "./sets.js";

/** Kept for callers that still want a raw per-minute product. */
export function computeTimeCharge(billedMinutes: number, ratePerMinuteYen: Yen): Yen {
  assertInteger(billedMinutes, "billedMinutes");
  assertInteger(ratePerMinuteYen, "ratePerMinuteYen");
  return billedMinutes * ratePerMinuteYen;
}

/**
 * Time charge for one guest, billed in sets / half-sets.
 *
 * - A `CLOSED` guest with stored snapshots returns them verbatim (history is
 *   never recomputed).
 * - Otherwise the charge is computed against `guest.closedAt ?? now`, using the
 *   set pricing snapshotted on the guest at seat-in (falling back to the current
 *   Settings when a snapshot is missing / zero — e.g. guests seated before the
 *   set-billing migration).
 */
export function computeGuestCharge(
  guest: Guest,
  settings: BillingSettings,
  now: Instant,
): GuestCharge {
  if (
    guest.status === GuestStatus.CLOSED &&
    guest.billedMinutes != null &&
    guest.timeChargeYen != null
  ) {
    const setPrice = guest.setPriceYenSnapshot || settings.setPriceYen;
    const halfPrice = guest.halfSetPriceYenSnapshot || settings.halfSetPriceYen;
    const sets = guest.timeChargeYen > 0 ? 1 : 0;
    const halfSets =
      sets && halfPrice > 0
        ? Math.max(0, Math.round((guest.timeChargeYen - setPrice) / halfPrice))
        : 0;
    return {
      guestId: guest.id,
      billedMinutes: guest.billedMinutes,
      timeChargeYen: guest.timeChargeYen,
      sets,
      halfSets,
    };
  }

  const endAt = guest.closedAt ?? now;
  const charge = computeSetCharge(guest.arrivalAt, endAt, {
    setMinutes: guest.setMinutesSnapshot || settings.setMinutes,
    setPriceYen: guest.setPriceYenSnapshot || settings.setPriceYen,
    halfSetPriceYen: guest.halfSetPriceYenSnapshot || settings.halfSetPriceYen,
    graceMinutes: settings.graceMinutes,
  });

  return {
    guestId: guest.id,
    billedMinutes: charge.billedMinutes,
    timeChargeYen: charge.timeChargeYen,
    sets: charge.sets,
    halfSets: charge.halfSets,
  };
}
