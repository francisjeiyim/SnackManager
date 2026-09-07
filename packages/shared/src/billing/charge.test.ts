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

describe("computeGuestCharge", () => {
  it("uses `now` for a seated guest (live estimate)", () => {
    const g = guest({ ratePerMinuteYenSnapshot: 8, arrivalAt: T0 });
    expect(computeGuestCharge(g, settings(), at(15))).toEqual({
      guestId: g.id,
      billedMinutes: 15,
      timeChargeYen: 120,
    });
  });

  it("uses closedAt when the guest has left but has no snapshot yet", () => {
    const g = guest({ arrivalAt: T0, closedAt: at(20), ratePerMinuteYenSnapshot: 10 });
    expect(computeGuestCharge(g, settings(), at(999))).toMatchObject({
      billedMinutes: 20,
      timeChargeYen: 200,
    });
  });

  it("returns stored snapshots verbatim for a CLOSED guest", () => {
    const g = guest({
      status: GuestStatus.CLOSED,
      closedAt: at(20),
      billedMinutes: 999,
      timeChargeYen: 12_345,
    });
    expect(computeGuestCharge(g, settings(), at(999))).toEqual({
      guestId: g.id,
      billedMinutes: 999,
      timeChargeYen: 12_345,
    });
  });

  it("snapshots the rate at seat-in, not the current default", () => {
    const g = guest({ ratePerMinuteYenSnapshot: 5, arrivalAt: T0 });
    expect(
      computeGuestCharge(g, settings({ defaultRatePerMinuteYen: 999 }), at(10)).timeChargeYen,
    ).toBe(50);
  });
});
