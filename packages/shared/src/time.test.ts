import { describe, expect, it } from "vitest";
import { elapsedMinutesExact, elapsedMs, MINUTE_MS, toDate } from "./time.js";

describe("toDate", () => {
  it("accepts Date, ISO string and epoch ms", () => {
    const iso = "2026-09-07T12:00:00.000Z";
    expect(toDate(iso).toISOString()).toBe(iso);
    expect(toDate(new Date(iso)).toISOString()).toBe(iso);
    expect(toDate(Date.parse(iso)).toISOString()).toBe(iso);
  });
  it("rejects invalid input", () => {
    expect(() => toDate("not a date")).toThrow(RangeError);
  });
});

describe("elapsed helpers", () => {
  const a = "2026-09-07T12:00:00.000Z";
  const b = "2026-09-07T12:03:30.000Z";

  it("elapsedMs clamps negatives to zero", () => {
    expect(elapsedMs(a, b)).toBe(3.5 * MINUTE_MS);
    expect(elapsedMs(b, a)).toBe(0);
  });

  it("elapsedMinutesExact returns fractional minutes", () => {
    expect(elapsedMinutesExact(a, b)).toBe(3.5);
    expect(elapsedMinutesExact(b, a)).toBe(0);
  });
});
