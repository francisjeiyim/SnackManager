import { describe, expect, it } from "vitest";
import { TimeRounding } from "../enums.js";
import { applyRounding, computeBilledMinutes } from "./minutes.js";
import { at, settings, T0 } from "./fixtures.js";

describe("applyRounding", () => {
  it("NONE truncates to whole minutes", () => {
    expect(applyRounding(3.9, TimeRounding.NONE)).toBe(3);
    expect(applyRounding(3, TimeRounding.NONE)).toBe(3);
  });
  it("CEIL_MINUTE rounds up to the next minute", () => {
    expect(applyRounding(3.01, TimeRounding.CEIL_MINUTE)).toBe(4);
    expect(applyRounding(3, TimeRounding.CEIL_MINUTE)).toBe(3);
  });
  it("CEIL_5MIN rounds up to the next multiple of 5", () => {
    expect(applyRounding(0.1, TimeRounding.CEIL_5MIN)).toBe(5);
    expect(applyRounding(5, TimeRounding.CEIL_5MIN)).toBe(5);
    expect(applyRounding(5.1, TimeRounding.CEIL_5MIN)).toBe(10);
  });
});

describe("computeBilledMinutes", () => {
  it("bills started minutes with the default CEIL_MINUTE", () => {
    expect(computeBilledMinutes(T0, at(12), settings())).toBe(12);
    expect(computeBilledMinutes(T0, at(12.2), settings())).toBe(13);
  });

  it("never goes negative for a zero or reversed interval", () => {
    expect(computeBilledMinutes(T0, T0, settings())).toBe(0);
    expect(computeBilledMinutes(at(10), T0, settings())).toBe(0);
  });

  it("subtracts the grace period before rounding", () => {
    const s = settings({ graceMinutes: 10 });
    expect(computeBilledMinutes(T0, at(9), s)).toBe(0);
    expect(computeBilledMinutes(T0, at(10), s)).toBe(0);
    expect(computeBilledMinutes(T0, at(10.5), s)).toBe(1);
  });

  it("enforces the minimum charge", () => {
    const s = settings({ minChargeMinutes: 30 });
    expect(computeBilledMinutes(T0, at(5), s)).toBe(30);
    expect(computeBilledMinutes(T0, at(45), s)).toBe(45);
  });

  it("combines grace, rounding and minimum", () => {
    const s = settings({
      graceMinutes: 5,
      minChargeMinutes: 15,
      timeRounding: TimeRounding.CEIL_5MIN,
    });
    // 22 elapsed - 5 grace = 17 -> ceil to 20 -> >= 15
    expect(computeBilledMinutes(T0, at(22), s)).toBe(20);
    // 6 elapsed - 5 grace = 1 -> ceil to 5 -> min 15
    expect(computeBilledMinutes(T0, at(6), s)).toBe(15);
  });
});
