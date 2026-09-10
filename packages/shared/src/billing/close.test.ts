import { describe, expect, it } from "vitest";
import { GuestStatus, TicketStatus } from "../enums.js";
import { planClose } from "./close.js";
import { at, bundle, guest, item, settings, T0, ticket } from "./fixtures.js";

describe("planClose", () => {
  it("freezes seated guests at `now` and lists their seats", () => {
    const b = bundle({
      guests: [
        guest({
          id: "g1",
          seatId: "s1",
          arrivalAt: "2026-09-07T12:00:00.000Z",
          ratePerMinuteYenSnapshot: 10,
        }),
        guest({
          id: "g2",
          seatId: "s2",
          arrivalAt: "2026-09-07T12:00:00.000Z",
          ratePerMinuteYenSnapshot: 10,
        }),
      ],
      items: [item({ unitPriceYen: 400, quantity: 1 })],
    });

    const plan = planClose(b, settings(), at(25));

    expect(plan.closedAt).toBe(at(25));
    expect(plan.guests).toEqual([
      { guestId: "g1", closedAt: at(25), billedMinutes: 25, timeChargeYen: 2000, validatedHalfSets: 0 },
      { guestId: "g2", closedAt: at(25), billedMinutes: 25, timeChargeYen: 2000, validatedHalfSets: 0 },
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
        guest({ id: "g2", seatId: "s2", ratePerMinuteYenSnapshot: 10 }),
      ],
    });
    const plan = planClose(b, settings(), at(30));
    expect(plan.guests.map((g) => g.guestId)).toEqual(["g2"]);
    expect(plan.totals.timeYen).toBe(100 + 2000);
  });

  it("bills consumed half-sets by default, or only validated ones on request", () => {
    // 136 min → 2 half-sets consumed, only 1 validated
    const g = guest({ id: "g1", seatId: "s1", arrivalAt: T0, validatedHalfSets: 1 });
    const b = bundle({ guests: [g] });

    const all = planClose(b, settings(), at(136));
    expect(all.guests[0].timeChargeYen).toBe(4000); // set + 2 half-sets
    expect(all.guests[0].validatedHalfSets).toBe(2);

    const validatedOnly = planClose(b, settings(), at(136), { billConsumed: false });
    expect(validatedOnly.guests[0].timeChargeYen).toBe(3000); // set + 1 half-set
    expect(validatedOnly.guests[0].validatedHalfSets).toBe(1);
  });

  it("refuses to close a ticket that is not OPEN", () => {
    const b = bundle({ ticket: ticket({ status: TicketStatus.PAID }) });
    expect(() => planClose(b, settings(), at(1))).toThrow(/cannot close/);
  });
});
