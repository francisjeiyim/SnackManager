import { describe, expect, it } from "vitest";
import { GuestStatus } from "../enums.js";
import { computeGuestCharge, computeTimeCharge } from "./charge.js";
import { at, guest, settings, T0 } from "./fixtures.js";

describe("computeTimeCharge", () => {
  it("multiplies minutes by the rate", () => {
    expect(computeTimeCharge(12, 10)).toBe(120);
    expect(computeTimeCharge(0, 10)).toBe(0);
  });
  it("rejects non-integer inputs", () => {
    expect(() => computeTimeCharge(1.5, 10)).toThrow(RangeError);
    expect(() => computeTimeCharge(10, 2.5)).toThrow(RangeError);
  });
});

describe("computeGuestCharge (set billing)", () => {
  it("charges the first full set for a seated guest past the grace window", () => {
    const g = guest({ arrivalAt: T0 });
    expect(computeGuestCharge(g, settings(), at(15))).toEqual({
      guestId: g.id,
      billedMinutes: 15,
      timeChargeYen: 2000,
      sets: 1,
      extensionSets: 0,
      extensionHalfSets: 0,
      paidUntilMinutes: 90,
      overdueMinutes: 0,
    });
  });

  it("charges nothing while within the grace window", () => {
    const g = guest({ arrivalAt: T0 });
    expect(computeGuestCharge(g, settings({ graceMinutes: 5 }), at(4))).toMatchObject({
      billedMinutes: 0,
      timeChargeYen: 0,
      sets: 0,
      overdueMinutes: 0,
    });
  });

  it("tracks overdue minutes past the paid time but does not bill them", () => {
    const g = guest({ arrivalAt: T0 });
    // 136 min seated, nothing validated → still just the first set, 46 min overdue
    expect(computeGuestCharge(g, settings(), at(136))).toMatchObject({
      billedMinutes: 136,
      timeChargeYen: 2000,
      sets: 1,
      extensionSets: 0,
      extensionHalfSets: 0,
      paidUntilMinutes: 90,
      overdueMinutes: 46,
    });
  });

  it("bills each validated extension block and extends the paid window", () => {
    // one validated full-set extension: 90 + 90 min paid, 2000 + 2000 yen
    const withSet = guest({
      arrivalAt: T0,
      extensionMinutes: 90,
      extensionYen: 2000,
      extensionSets: 1,
    });
    expect(computeGuestCharge(withSet, settings(), at(200))).toMatchObject({
      timeChargeYen: 4000,
      sets: 1,
      extensionSets: 1,
      extensionHalfSets: 0,
      paidUntilMinutes: 180,
      overdueMinutes: 20,
    });

    // plus a half-set on top: 90 + 90 + 45 min paid, 2000 + 2000 + 1000 yen
    const withSetAndHalf = guest({
      arrivalAt: T0,
      extensionMinutes: 135,
      extensionYen: 3000,
      extensionSets: 1,
      extensionHalfSets: 1,
    });
    expect(computeGuestCharge(withSetAndHalf, settings(), at(200))).toMatchObject({
      timeChargeYen: 5000,
      extensionSets: 1,
      extensionHalfSets: 1,
      paidUntilMinutes: 225,
      overdueMinutes: 0,
    });
  });

  it("returns stored snapshots verbatim for a CLOSED guest", () => {
    const g = guest({
      status: GuestStatus.CLOSED,
      closedAt: at(20),
      billedMinutes: 999,
      timeChargeYen: 12_345,
      extensionSets: 2,
      extensionHalfSets: 1,
    });
    expect(computeGuestCharge(g, settings(), at(999))).toMatchObject({
      guestId: g.id,
      billedMinutes: 999,
      timeChargeYen: 12_345,
      sets: 1,
      extensionSets: 2,
      extensionHalfSets: 1,
      paidUntilMinutes: 999,
      overdueMinutes: 0,
    });
  });

  it("uses the pricing snapshotted at seat-in, not the current Settings", () => {
    const g = guest({ arrivalAt: T0, setPriceYenSnapshot: 500, halfSetPriceYenSnapshot: 250 });
    expect(
      computeGuestCharge(g, settings({ setPriceYen: 9999, halfSetPriceYen: 9999 }), at(10))
        .timeChargeYen,
    ).toBe(500);
  });

  it("falls back to current Settings when the snapshot is missing (pre-migration guest)", () => {
    const g = guest({
      arrivalAt: T0,
      setMinutesSnapshot: 0,
      setPriceYenSnapshot: 0,
      halfSetPriceYenSnapshot: 0,
    });
    expect(
      computeGuestCharge(g, settings({ setPriceYen: 1500, halfSetPriceYen: 700 }), at(10))
        .timeChargeYen,
    ).toBe(1500);
  });
});
