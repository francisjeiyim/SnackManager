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
 * Time charge for one guest, billed as: first set + every validated
 * set / half-set extension. A `CLOSED` guest returns its frozen snapshots.
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
    return {
      guestId: guest.id,
      billedMinutes: guest.billedMinutes,
      timeChargeYen: guest.timeChargeYen,
      sets: guest.timeChargeYen > 0 ? 1 : 0,
      extensionSets: guest.extensionSets ?? 0,
      extensionHalfSets: guest.extensionHalfSets ?? 0,
      paidUntilMinutes: guest.billedMinutes,
      overdueMinutes: 0,
    };
  }

  const endAt = guest.closedAt ?? now;
  const charge = computeSetCharge(guest.arrivalAt, endAt, {
    setMinutes: guest.setMinutesSnapshot || settings.setMinutes,
    setPriceYen: guest.setPriceYenSnapshot || settings.setPriceYen,
    halfSetPriceYen: guest.halfSetPriceYenSnapshot || settings.halfSetPriceYen,
    graceMinutes: settings.graceMinutes,
    extensionMinutes: guest.extensionMinutes ?? 0,
    extensionYen: guest.extensionYen ?? 0,
    extensionSets: guest.extensionSets ?? 0,
    extensionHalfSets: guest.extensionHalfSets ?? 0,
  });

  return {
    guestId: guest.id,
    billedMinutes: charge.billedMinutes,
    timeChargeYen: charge.timeChargeYen,
    sets: charge.sets,
    extensionSets: charge.extensionSets,
    extensionHalfSets: charge.extensionHalfSets,
    paidUntilMinutes: charge.paidUntilMinutes,
    overdueMinutes: charge.overdueMinutes,
  };
}
