import { TimeRounding } from "../enums.js";
import { elapsedMinutesExact } from "../time.js";
import type { Instant } from "../types.js";

/** Inputs to the legacy per-minute billing math. */
export interface MinutesSettings {
  graceMinutes: number;
  minChargeMinutes: number;
  timeRounding: TimeRounding;
}

/** Apply the configured rounding to a fractional minute count. */
export function applyRounding(minutes: number, mode: TimeRounding): number {
  switch (mode) {
    case TimeRounding.NONE:
      return Math.floor(minutes);
    case TimeRounding.CEIL_MINUTE:
      return Math.ceil(minutes);
    case TimeRounding.CEIL_5MIN:
      return Math.ceil(minutes / 5) * 5;
    default: {
      const _exhaustive: never = mode;
      return _exhaustive;
    }
  }
}

/**
 * Billable minutes for one guest:
 *
 * 1. exact elapsed minutes (`>= 0`)
 * 2. minus `graceMinutes` (floored at 0)
 * 3. rounded per `timeRounding`
 * 4. floored at `minChargeMinutes`
 */
export function computeBilledMinutes(
  arrivalAt: Instant,
  endAt: Instant,
  settings: MinutesSettings,
): number {
  const exact = elapsedMinutesExact(arrivalAt, endAt);
  const afterGrace = Math.max(0, exact - Math.max(0, settings.graceMinutes));
  const rounded = applyRounding(afterGrace, settings.timeRounding);
  return Math.max(rounded, Math.max(0, settings.minChargeMinutes));
}
