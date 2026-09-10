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
      halfSets: 0,
    });
  });

  it("charges nothing while within the grace window", () => {
    const g = guest({ arrivalAt: T0 });
    expect(computeGuestCharge(g, settings({ graceMinutes: 5 }), at(4))).toMatchObject({
      billedMinutes: 0,
      timeChargeYen: 0,
      sets: 0,
      halfSets: 0,
    });
  });

  it("adds half-sets past the first set, up to closedAt", () => {
    const g = guest({ arrivalAt: T0, closedAt: at(136) });
    expect(computeGuestCharge(g, settings(), at(999))).toMatchObject({
      billedMinutes: 136,
      // 1 set (2000) + 2 half-sets (2 * 1000)
      timeChargeYen: 4000,
      sets: 1,
      halfSets: 2,
    });
  });

  it("returns stored snapshots verbatim for a CLOSED guest", () => {
    const g = guest({
      status: GuestStatus.CLOSED,
      closedAt: at(20),
      billedMinutes: 999,
      timeChargeYen: 12_345,
    });
    expect(computeGuestCharge(g, settings(), at(999))).toMatchObject({
      guestId: g.id,
      billedMinutes: 999,
      timeChargeYen: 12_345,
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
