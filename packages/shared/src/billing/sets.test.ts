import { describe, expect, it } from "vitest";
import { computeSetCharge } from "./sets.js";
import { at, T0 } from "./fixtures.js";

const P = { setMinutes: 90, setPriceYen: 2000, halfSetPriceYen: 1000, graceMinutes: 5 };

type Over = Partial<
  typeof P & {
    extensionMinutes: number;
    extensionYen: number;
    extensionSets: number;
    extensionHalfSets: number;
  }
>;
const charge = (mins: number, over: Over = {}) =>
  computeSetCharge(T0, at(mins), { ...P, ...over });

describe("computeSetCharge", () => {
  it("charges nothing up to and including the grace window", () => {
    expect(charge(0)).toMatchObject({ sets: 0, timeChargeYen: 0, overdueMinutes: 0 });
    expect(charge(5)).toMatchObject({ sets: 0, timeChargeYen: 0 });
  });

  it("charges the first full set past the grace window", () => {
    expect(charge(6)).toMatchObject({ sets: 1, timeChargeYen: 2000, paidUntilMinutes: 90 });
    expect(charge(90)).toMatchObject({ sets: 1, timeChargeYen: 2000, overdueMinutes: 0 });
  });

  it("tracks overdue minutes once the paid time runs out, without billing them", () => {
    expect(charge(200)).toMatchObject({
      sets: 1,
      timeChargeYen: 2000,
      paidUntilMinutes: 90,
      overdueMinutes: 110,
    });
  });

  it("adds a validated full-set extension: paid time and price grow", () => {
    expect(
      charge(200, { extensionMinutes: 90, extensionYen: 2000, extensionSets: 1 }),
    ).toMatchObject({
      timeChargeYen: 4000,
      paidUntilMinutes: 180,
      overdueMinutes: 20,
      extensionSets: 1,
    });
  });

  it("adds a validated half-set extension on top", () => {
    expect(
      charge(200, {
        extensionMinutes: 90 + 45,
        extensionYen: 2000 + 1000,
        extensionSets: 1,
        extensionHalfSets: 1,
      }),
    ).toMatchObject({
      timeChargeYen: 5000,
      paidUntilMinutes: 225,
      overdueMinutes: 0,
      extensionSets: 1,
      extensionHalfSets: 1,
    });
  });

  it("reports whole elapsed minutes for display", () => {
    expect(charge(136).billedMinutes).toBe(136);
    expect(
      computeSetCharge(T0, new Date(Date.parse(T0) + 90.5 * 60_000), P).billedMinutes,
    ).toBe(91);
  });
});
