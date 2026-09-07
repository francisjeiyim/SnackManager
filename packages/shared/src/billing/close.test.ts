import { describe, expect, it } from "vitest";
import { GuestStatus, TicketStatus } from "../enums.js";
import { planClose } from "./close.js";
import { at, bundle, guest, item, settings, ticket } from "./fixtures.js";

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
      { guestId: "g1", closedAt: at(25), billedMinutes: 25, timeChargeYen: 250 },
      { guestId: "g2", closedAt: at(25), billedMinutes: 25, timeChargeYen: 250 },
    ]);
    expect(plan.freeSeatIds).toEqual(["s1", "s2"]);
    expect(plan.totals.timeYen).toBe(500);
    expect(plan.totals.productsYen).toBe(400);
    expect(plan.totals.totalYen).toBe(900);
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
    expect(plan.totals.timeYen).toBe(100 + 300);
  });

  it("refuses to close a ticket that is not OPEN", () => {
    const b = bundle({ ticket: ticket({ status: TicketStatus.PAID }) });
    expect(() => planClose(b, settings(), at(1))).toThrow(/cannot close/);
  });
});
