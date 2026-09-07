import type { Instant } from "./types.js";

export const MINUTE_MS = 60_000;

/** Coerce an {@link Instant} to a `Date`, rejecting invalid input. */
export function toDate(value: Instant): Date {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new RangeError(`invalid instant: ${String(value)}`);
  }
  return d;
}

/** Milliseconds from `from` to `to`, clamped to `>= 0`. */
export function elapsedMs(from: Instant, to: Instant): number {
  return Math.max(0, toDate(to).getTime() - toDate(from).getTime());
}

/** Exact (fractional) minutes from `from` to `to`, clamped to `>= 0`. */
export function elapsedMinutesExact(from: Instant, to: Instant): number {
  return elapsedMs(from, to) / MINUTE_MS;
}
