import type { Yen } from "./types.js";

/** Throw unless `n` is a finite integer. */
export function assertInteger(n: number, label = "amount"): void {
  if (!Number.isInteger(n)) {
    throw new RangeError(`${label} must be a finite integer, got ${n}`);
  }
}

export function sumYen(values: Iterable<Yen>): Yen {
  let total = 0;
  for (const v of values) total += v;
  return total;
}

/**
 * Divide `total` into `parts` integer shares that sum **exactly** to `total`.
 * The remainder (`|remainder| < parts`) is added to the last share, so the last
 * payer absorbs the rounding — matches the "reste sur la dernière part" rule.
 */
export function splitEven(total: Yen, parts: number): Yen[] {
  assertInteger(total, "total");
  if (!Number.isInteger(parts) || parts <= 0) {
    throw new RangeError(`parts must be a positive integer, got ${parts}`);
  }
  const base = Math.trunc(total / parts);
  const remainder = total - base * parts;
  return Array.from({ length: parts }, (_unused, i) => (i === parts - 1 ? base + remainder : base));
}

/** Round half away from zero to an integer. */
export function roundHalfUp(n: number): number {
  return Math.sign(n) * Math.round(Math.abs(n));
}
