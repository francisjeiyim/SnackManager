import { describe, expect, it } from "vitest";
import { computeSetCharge } from "./sets.js";
import { at, T0 } from "./fixtures.js";

const P = { setMinutes: 90, setPriceYen: 2000, halfSetPriceYen: 1000, graceMinutes: 5 };

const charge = (mins: number, over: Partial<typeof P & { validatedHalfSets: number }> = {}) =>
  computeSetCharge(T0, at(mins), { ...P, ...over });

describe("computeSetCharge", () => {
  it("charges nothing up to and including the grace window", () => {
    expect(charge(0)).toMatchObject({ sets: 0, timeChargeYen: 0, consumedHalfSets: 0 });
    expect(charge(5)).toMatchObject({ sets: 0, timeChargeYen: 0 });
  });

  it("charges one full set past the grace window, no matter the validation", () => {
    expect(charge(6)).toMatchObject({ sets: 1, halfSets: 0, timeChargeYen: 2000 });
    expect(charge(90)).toMatchObject({ sets: 1, halfSets: 0, consumedHalfSets: 0, timeChargeYen: 2000 });
  });

  it("tracks consumed half-sets by the clock but only bills validated ones", () => {
    // 100 min → one half-set consumed, none validated yet
    expect(charge(100)).toMatchObject({
      consumedHalfSets: 1,
      halfSets: 0,
      timeChargeYen: 2000,
    });
    // same stay, operator validated 1
    expect(charge(100, { validatedHalfSets: 1 })).toMatchObject({
      consumedHalfSets: 1,
      halfSets: 1,
      timeChargeYen: 3000,
    });
  });

  it("caps billed half-sets at what has actually been consumed", () => {
    expect(charge(100, { validatedHalfSets: 5 })).toMatchObject({
      consumedHalfSets: 1,
      halfSets: 1,
      timeChargeYen: 3000,
    });
  });

  it("counts a second consumed half-set past 135 min", () => {
    expect(charge(136, { validatedHalfSets: 2 })).toMatchObject({
      consumedHalfSets: 2,
      halfSets: 2,
      timeChargeYen: 4000,
    });
    expect(charge(136, { validatedHalfSets: 1 })).toMatchObject({
      consumedHalfSets: 2,
      halfSets: 1,
      timeChargeYen: 3000,
    });
  });

  it("reports whole elapsed minutes for display", () => {
    expect(charge(136).billedMinutes).toBe(136);
    const c = computeSetCharge(T0, new Date(Date.parse(T0) + 90.5 * 60_000), P);
    expect(c.billedMinutes).toBe(91);
    expect(c).toMatchObject({ sets: 1, consumedHalfSets: 1 });
  });

  it("honours a custom set length", () => {
    const c = computeSetCharge(T0, at(61), {
      setMinutes: 60,
      setPriceYen: 1000,
      halfSetPriceYen: 500,
      graceMinutes: 0,
      validatedHalfSets: 1,
    });
    expect(c).toMatchObject({ sets: 1, consumedHalfSets: 1, halfSets: 1, timeChargeYen: 1500 });
  });
});
