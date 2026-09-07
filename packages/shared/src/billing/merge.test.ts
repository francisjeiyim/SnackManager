import { describe, expect, it } from "vitest";
import { TicketStatus } from "../enums.js";
import { planMerge } from "./merge.js";
import { at, bundle, guest, item, settings, ticket } from "./fixtures.js";

describe("planMerge", () => {
  const target = bundle({
    ticket: ticket({ id: "t_target" }),
    guests: [
      guest({
        id: "gt",
        ticketId: "t_target",
        arrivalAt: "2026-09-07T12:00:00.000Z",
        ratePerMinuteYenSnapshot: 10,
      }),
    ],
    items: [item({ id: "it", ticketId: "t_target", unitPriceYen: 200, quantity: 1 })],
  });
  const sourceA = bundle({
    ticket: ticket({ id: "t_a" }),
    guests: [
      guest({
        id: "ga",
        ticketId: "t_a",
        arrivalAt: "2026-09-07T12:00:00.000Z",
        ratePerMinuteYenSnapshot: 10,
      }),
    ],
    items: [item({ id: "ia", ticketId: "t_a", unitPriceYen: 500, quantity: 1 })],
  });
  const sourceB = bundle({
    ticket: ticket({ id: "t_b" }),
    guests: [],
    items: [item({ id: "ib", ticketId: "t_b", unitPriceYen: 100, quantity: 3 })],
  });

  it("reassigns every guest and item and voids the sources", () => {
    const plan = planMerge(target, [sourceA, sourceB], settings(), at(10));
    expect(plan.targetTicketId).toBe("t_target");
    expect(plan.reassignGuestIds).toEqual(["ga"]);
    expect(plan.reassignItemIds).toEqual(["ia", "ib"]);
    expect(plan.voidTicketIds).toEqual(["t_a", "t_b"]);
  });

  it("recomputes the combined total", () => {
    const plan = planMerge(target, [sourceA, sourceB], settings(), at(10));
    // time: (gt + ga) * 10 min * 10 = 200 ; products: 200 + 500 + 300 = 1000
    expect(plan.totals.timeYen).toBe(200);
    expect(plan.totals.productsYen).toBe(1000);
    expect(plan.totals.totalYen).toBe(1200);
  });

  it("rejects a non-open ticket", () => {
    const bad = bundle({ ticket: ticket({ id: "t_bad", status: TicketStatus.CLOSED }) });
    expect(() => planMerge(target, [bad], settings(), at(0))).toThrow(/only OPEN tickets/);
  });

  it("rejects a duplicate ticket id", () => {
    expect(() => planMerge(target, [sourceA, sourceA], settings(), at(0))).toThrow(/listed twice/);
  });

  it("requires at least one source", () => {
    expect(() => planMerge(target, [], settings(), at(0))).toThrow(/at least one source/);
  });
});
