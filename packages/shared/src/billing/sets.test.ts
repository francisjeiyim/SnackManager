import { describe, expect, it } from "vitest";
import { computeSetCharge } from "./sets.js";
import { at, T0 } from "./fixtures.js";

const P = { setMinutes: 90, setPriceYen: 2000, halfSetPriceYen: 1000, graceMinutes: 5 };

const charge = (mins: number, over: Partial<typeof P> = {}) =>
  computeSetCharge(T0, at(mins), { ...P, ...over });

describe("computeSetCharge", () => {
  it("charges nothing up to and including the grace window", () => {
    expect(charge(0)).toEqual({ sets: 0, halfSets: 0, billedMinutes: 0, timeChargeYen: 0 });
    expect(charge(5)).toMatchObject({ sets: 0, timeChargeYen: 0 });
  });

  it("charges one full set the moment the grace window is exceeded", () => {
    expect(charge(6)).toMatchObject({ sets: 1, halfSets: 0, timeChargeYen: 2000 });
    expect(charge(89)).toMatchObject({ sets: 1, halfSets: 0, timeChargeYen: 2000 });
    expect(charge(90)).toMatchObject({ sets: 1, halfSets: 0, timeChargeYen: 2000 });
  });

  it("adds one half-set for any minute past the first set", () => {
    expect(charge(91)).toMatchObject({ halfSets: 1, timeChargeYen: 3000 });
    expect(charge(135)).toMatchObject({ halfSets: 1, timeChargeYen: 3000 });
  });

  it("adds a second half-set past 135 min", () => {
    expect(charge(136)).toMatchObject({ halfSets: 2, timeChargeYen: 4000 });
    expect(charge(180)).toMatchObject({ halfSets: 2, timeChargeYen: 4000 });
    expect(charge(181)).toMatchObject({ halfSets: 3, timeChargeYen: 5000 });
    expect(charge(225)).toMatchObject({ halfSets: 3, timeChargeYen: 5000 });
  });

  it("reports whole elapsed minutes for display (ceil of the fraction)", () => {
    expect(charge(136).billedMinutes).toBe(136);
    // 90 min 30 s of stay → 91 whole minutes, still inside the first set
    const c = computeSetCharge(T0, new Date(Date.parse(T0) + 90.5 * 60_000), P);
    expect(c.billedMinutes).toBe(91);
    expect(c).toMatchObject({ sets: 1, halfSets: 1 });
  });

  it("honours a custom set length", () => {
    const c = computeSetCharge(T0, at(61), {
      setMinutes: 60,
      setPriceYen: 1000,
      halfSetPriceYen: 500,
      graceMinutes: 0,
    });
    expect(c).toMatchObject({ sets: 1, halfSets: 1, timeChargeYen: 1500 });
  });
});
