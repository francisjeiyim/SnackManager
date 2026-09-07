import { GuestStatus } from "../enums.js";
import { assertInteger } from "../money.js";
import type { BillingSettings, Guest, GuestCharge, Instant, Yen } from "../types.js";
import { computeBilledMinutes } from "./minutes.js";

/** `billedMinutes * ratePerMinuteYen`, both required to be integers. */
export function computeTimeCharge(billedMinutes: number, ratePerMinuteYen: Yen): Yen {
  assertInteger(billedMinutes, "billedMinutes");
  assertInteger(ratePerMinuteYen, "ratePerMinuteYen");
  return billedMinutes * ratePerMinuteYen;
}

/**
 * Time charge for one guest.
 *
 * - A `CLOSED` guest with stored snapshots returns them verbatim (history is
 *   never recomputed).
 * - Otherwise the charge is computed against `guest.closedAt ?? now`, using the
 *   rate snapshotted on the guest at seat-in (falling back to the current
 *   default only if no snapshot exists).
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
    };
  }

  const endAt = guest.closedAt ?? now;
  const rate = guest.ratePerMinuteYenSnapshot ?? settings.defaultRatePerMinuteYen;
  const billedMinutes = computeBilledMinutes(guest.arrivalAt, endAt, settings);
  return {
    guestId: guest.id,
    billedMinutes,
    timeChargeYen: computeTimeCharge(billedMinutes, rate),
  };
}
