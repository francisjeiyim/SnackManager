import { describe, expect, it } from "vitest";
import { GuestStatus, TicketStatus } from "../enums.js";
import { planClose } from "./close.js";
import { at, bundle, guest, item, settings, T0, ticket } from "./fixtures.js";

describe("planClose", () => {
  it("freezes seated guests at `now` and lists their seats", () => {
    const b = bundle({
      guests: [
        guest({ id: "g1", seatId: "s1", arrivalAt: T0 }),
        guest({ id: "g2", seatId: "s2", arrivalAt: T0 }),
      ],
      items: [item({ unitPriceYen: 400, quantity: 1 })],
    });

    const plan = planClose(b, settings(), at(25));

    expect(plan.closedAt).toBe(at(25));
    expect(plan.guests).toEqual([
      {
        guestId: "g1",
        closedAt: at(25),
        billedMinutes: 25,
        timeChargeYen: 2000,
        appendExtension: null,
      },
      {
        guestId: "g2",
        closedAt: at(25),
        billedMinutes: 25,
        timeChargeYen: 2000,
        appendExtension: null,
      },
    ]);
    expect(plan.freeSeatIds).toEqual(["s1", "s2"]);
    expect(plan.totals.timeYen).toBe(4000);
    expect(plan.totals.productsYen).toBe(400);
    expect(plan.totals.totalYen).toBe(4400);
  });

  it("leaves already-closed guests untouched", () => {
    const b = bundle({
      guests: [
        guest({
          id: "g1",
          status: GuestStatus.CLOSED,
          closedAt: at(10),
          billedMinutes: 10,
          timeChargeYen: 100,
        }),
        guest({ id: "g2", seatId: "s2" }),
      ],
    });
    const plan = planClose(b, settings(), at(30));
    expect(plan.guests.map((g) => g.guestId)).toEqual(["g2"]);
    expect(plan.totals.timeYen).toBe(100 + 2000);
  });

  it("bills only the validated blocks when no overdue cover is requested", () => {
    // 200 min seated, set = 90 → 110 min overdue, but nothing extra is billed
    const g = guest({ id: "g1", seatId: "s1", arrivalAt: T0 });
    const b = bundle({ guests: [g] });

    const plan = planClose(b, settings(), at(200));
    expect(plan.guests[0]).toMatchObject({ timeChargeYen: 2000, appendExtension: null });
    expect(plan.totals.timeYen).toBe(2000);

    const explicitNone = planClose(b, settings(), at(200), { overdueExtension: "NONE" });
    expect(explicitNone.guests[0]).toMatchObject({ timeChargeYen: 2000, appendExtension: null });
  });

  it("covers an overdue guest with a full-set block on request", () => {
    const g = guest({ id: "g1", seatId: "s1", arrivalAt: T0 });
    const b = bundle({ guests: [g] });

    const plan = planClose(b, settings(), at(200), { overdueExtension: "SET" });
    expect(plan.guests[0]).toMatchObject({
      timeChargeYen: 4000,
      appendExtension: { kind: "SET", minutes: 90, priceYen: 2000 },
    });
    expect(plan.totals.timeYen).toBe(4000);
  });

  it("covers an overdue guest with a half-set block on request", () => {
    const g = guest({ id: "g1", seatId: "s1", arrivalAt: T0 });
    const b = bundle({ guests: [g] });

    const plan = planClose(b, settings(), at(200), { overdueExtension: "HALF" });
    expect(plan.guests[0]).toMatchObject({
      timeChargeYen: 3000,
      appendExtension: { kind: "HALF", minutes: 45, priceYen: 1000 },
    });
    expect(plan.totals.timeYen).toBe(3000);
  });

  it("adds the overdue block on top of already-validated extensions", () => {
    // one full-set already validated (90 min / 2000 yen), still 20 min overdue at 200
    const g = guest({
      id: "g1",
      seatId: "s1",
      arrivalAt: T0,
      extensionMinutes: 90,
      extensionYen: 2000,
      extensionSets: 1,
    });
    const b = bundle({ guests: [g] });

    const plan = planClose(b, settings(), at(200), { overdueExtension: "HALF" });
    expect(plan.guests[0]).toMatchObject({
      timeChargeYen: 5000, // set + validated set + covering half-set
      appendExtension: { kind: "HALF", minutes: 45, priceYen: 1000 },
    });
  });

  it("does not add a block when the guest is still within the paid time", () => {
    const g = guest({ id: "g1", seatId: "s1", arrivalAt: T0 });
    const b = bundle({ guests: [g] });

    const plan = planClose(b, settings(), at(40), { overdueExtension: "SET" });
    expect(plan.guests[0]).toMatchObject({ timeChargeYen: 2000, appendExtension: null });
  });

  it("refuses to close a ticket that is not OPEN", () => {
    const b = bundle({ ticket: ticket({ status: TicketStatus.PAID }) });
    expect(() => planClose(b, settings(), at(1))).toThrow(/cannot close/);
  });
});
