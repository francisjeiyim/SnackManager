import { describe, expect, it } from "vitest";
import { assertInteger, roundHalfUp, splitEven, sumYen } from "./money.js";

describe("sumYen", () => {
  it("adds an iterable of integers", () => {
    expect(sumYen([1, 2, 3])).toBe(6);
    expect(sumYen([])).toBe(0);
  });
});

describe("assertInteger", () => {
  it("passes for integers", () => {
    expect(() => assertInteger(0)).not.toThrow();
    expect(() => assertInteger(-42)).not.toThrow();
  });
  it("throws for non-integers", () => {
    expect(() => assertInteger(1.5, "rate")).toThrow(/rate must be a finite integer/);
    expect(() => assertInteger(Number.NaN)).toThrow(RangeError);
  });
});

describe("splitEven", () => {
  it("divides evenly when there is no remainder", () => {
    expect(splitEven(900, 3)).toEqual([300, 300, 300]);
  });

  it("puts the remainder on the last share", () => {
    expect(splitEven(1000, 3)).toEqual([333, 333, 334]);
    expect(splitEven(10, 7)).toEqual([1, 1, 1, 1, 1, 1, 4]);
  });

  it("always sums back to the original total", () => {
    for (const [total, parts] of [
      [1000, 3],
      [999, 4],
      [1, 5],
      [123_456, 7],
    ] as const) {
      const shares = splitEven(total, parts);
      expect(shares).toHaveLength(parts);
      expect(sumYen(shares)).toBe(total);
    }
  });

  it("handles a single part", () => {
    expect(splitEven(777, 1)).toEqual([777]);
  });

  it("rejects bad inputs", () => {
    expect(() => splitEven(100, 0)).toThrow(RangeError);
    expect(() => splitEven(100, -2)).toThrow(RangeError);
    expect(() => splitEven(100.5, 2)).toThrow(RangeError);
  });
});

describe("roundHalfUp", () => {
  it("rounds halves away from zero", () => {
    expect(roundHalfUp(2.5)).toBe(3);
    expect(roundHalfUp(-2.5)).toBe(-3);
    expect(roundHalfUp(2.4)).toBe(2);
  });
});
