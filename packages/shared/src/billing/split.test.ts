import { describe, expect, it } from "vitest";
import { TicketStatus } from "../enums.js";
import { planEvenSplit, planGroupedSplit, planItemizedSplit, planSplit } from "./split.js";
import { at, bundle, guest, item, settings, ticket } from "./fixtures.js";

const origin = () =>
  bundle({
    ticket: ticket({ id: "t_o" }),
    guests: [
      guest({
        id: "g1",
        ticketId: "t_o",
        arrivalAt: "2026-09-07T12:00:00.000Z",
        ratePerMinuteYenSnapshot: 10,
      }),
      guest({
        id: "g2",
        ticketId: "t_o",
        arrivalAt: "2026-09-07T12:00:00.000Z",
        ratePerMinuteYenSnapshot: 10,
      }),
    ],
    items: [
      item({ id: "i1", ticketId: "t_o", unitPriceYen: 300, quantity: 1 }),
      item({ id: "i2", ticketId: "t_o", unitPriceYen: 700, quantity: 1 }),
    ],
  });

describe("planEvenSplit", () => {
  it("divides the running total into equal shares summing to the total", () => {
    // time: 2 * 10min * 10 = 200 ; products: 1000 ; total 1200
    const plan = planEvenSplit(origin(), { mode: "EVEN", parts: 3 }, settings(), at(10));
    expect(plan.total).toBe(1200);
    expect(plan.shares).toEqual([400, 400, 400]);
  });

  it("puts the odd yen on the last share", () => {
    const plan = planEvenSplit(origin(), { mode: "EVEN", parts: 7 }, settings(), at(10));
    expect(plan.shares.reduce((a, b) => a + b, 0)).toBe(plan.total);
    expect(plan.shares).toHaveLength(7);
  });

  it("needs at least 2 parts", () => {
    expect(() => planEvenSplit(origin(), { mode: "EVEN", parts: 1 }, settings(), at(0))).toThrow(
      /at least 2 parts/,
    );
  });
});

describe("planItemizedSplit", () => {
  it("moves selected guests and items onto a new ticket and recomputes both", () => {
    const plan = planItemizedSplit(
      origin(),
      { mode: "ITEMIZED", newTicketId: "t_new", guestIds: ["g2"], itemIds: ["i2"] },
      settings(),
      at(10),
    );
    expect(plan.newTicketId).toBe("t_new");
    expect(plan.moveGuestIds).toEqual(["g2"]);
    expect(plan.moveItemIds).toEqual(["i2"]);
    // origin keeps g1 (100) + i1 (300) = 400 ; new gets g2 (100) + i2 (700) = 800
    expect(plan.originTotals.totalYen).toBe(400);
    expect(plan.newTotals.totalYen).toBe(800);
  });

  it("rejects a guest that is not on the ticket", () => {
    expect(() =>
      planItemizedSplit(
        origin(),
        { mode: "ITEMIZED", newTicketId: "t_new", guestIds: ["ghost"], itemIds: [] },
        settings(),
        at(0),
      ),
    ).toThrow(/not on ticket/);
  });

  it("rejects an empty selection", () => {
    expect(() =>
      planItemizedSplit(
        origin(),
        { mode: "ITEMIZED", newTicketId: "t_new", guestIds: [], itemIds: [] },
        settings(),
        at(0),
      ),
    ).toThrow(/nothing selected/);
  });

  it("rejects moving the whole ticket", () => {
    expect(() =>
      planItemizedSplit(
        origin(),
        { mode: "ITEMIZED", newTicketId: "t_new", guestIds: ["g1", "g2"], itemIds: ["i1", "i2"] },
        settings(),
        at(0),
      ),
    ).toThrow(/entire ticket/);
  });

  it("rejects splitting a non-open ticket", () => {
    const closed = { ...origin(), ticket: ticket({ id: "t_o", status: TicketStatus.CLOSED }) };
    expect(() =>
      planItemizedSplit(
        closed,
        { mode: "ITEMIZED", newTicketId: "t_new", guestIds: ["g1"], itemIds: [] },
        settings(),
        at(0),
      ),
    ).toThrow(/cannot split/);
  });
});

describe("planSplit dispatch", () => {
  it("routes by mode", () => {
    expect(planSplit(origin(), { mode: "EVEN", parts: 2 }, settings(), at(10)).mode).toBe("EVEN");
    expect(
      planSplit(
        origin(),
        { mode: "ITEMIZED", newTicketId: "t_new", guestIds: ["g1"], itemIds: [] },
        settings(),
        at(10),
      ).mode,
    ).toBe("ITEMIZED");
  });
});

const trio = () =>
  bundle({
    ticket: ticket({ id: "t_o" }),
    guests: [
      guest({
        id: "g1",
        ticketId: "t_o",
        arrivalAt: "2026-09-07T12:00:00.000Z",
        ratePerMinuteYenSnapshot: 10,
      }),
      guest({
        id: "g2",
        ticketId: "t_o",
        arrivalAt: "2026-09-07T12:00:00.000Z",
        ratePerMinuteYenSnapshot: 10,
      }),
      guest({
        id: "g3",
        ticketId: "t_o",
        arrivalAt: "2026-09-07T12:00:00.000Z",
        ratePerMinuteYenSnapshot: 10,
      }),
    ],
    items: [
      item({ id: "i1", ticketId: "t_o", unitPriceYen: 300, quantity: 1, guestId: "g2" }),
      item({ id: "i2", ticketId: "t_o", unitPriceYen: 500, quantity: 1, guestId: "g3" }),
      item({ id: "iShared", ticketId: "t_o", unitPriceYen: 900, quantity: 1 }),
    ],
  });

describe("planGroupedSplit", () => {
  const opts = { mode: "GROUPS" as const, newTicketIds: ["t_a", "t_b"] };

  it("partitions guests into groups and routes items by guest", () => {
    const plan = planGroupedSplit(
      trio(),
      { ...opts, groups: [["g1"], ["g2", "g3"]] },
      settings(),
      at(10),
    );

    expect(plan.groups).toHaveLength(2);
    const [g0, g1] = plan.groups;
    expect(g0.ticketId).toBe("t_o"); // group 0 keeps the origin
    expect(g1.ticketId).toBe("t_a");
    expect(g0.guestIds).toEqual(["g1"]);
    expect(g1.guestIds).toEqual(["g2", "g3"]);

    // group 0: g1 time (100) + shared item 900 = 1000
    expect(g0.totals.totalYen).toBe(1000);
    expect(g0.itemIds).toEqual(["iShared"]);
    // group 1: g2+g3 time (200) + i1 (300) + i2 (500) = 1000
    expect(g1.totals.totalYen).toBe(1000);
    expect(g1.itemIds).toEqual(["i1", "i2"]);
  });

  it("supports three groups", () => {
    const plan = planGroupedSplit(
      trio(),
      { ...opts, groups: [["g1"], ["g2"], ["g3"]] },
      settings(),
      at(10),
    );
    expect(plan.groups.map((g) => g.ticketId)).toEqual(["t_o", "t_a", "t_b"]);
  });

  it("rejects an unassigned guest", () => {
    expect(() =>
      planGroupedSplit(trio(), { ...opts, groups: [["g1"], ["g2"]] }, settings(), at(0)),
    ).toThrow(/every guest must be assigned/);
  });

  it("rejects a guest placed in two groups", () => {
    expect(() =>
      planGroupedSplit(
        trio(),
        {
          ...opts,
          groups: [
            ["g1", "g2"],
            ["g2", "g3"],
          ],
        },
        settings(),
        at(0),
      ),
    ).toThrow(/more than one group/);
  });

  it("rejects fewer than 2 groups", () => {
    expect(() =>
      planGroupedSplit(trio(), { ...opts, groups: [["g1", "g2", "g3"]] }, settings(), at(0)),
    ).toThrow(/at least 2 groups/);
  });

  it("rejects a group that holds every guest", () => {
    expect(() =>
      planGroupedSplit(trio(), { ...opts, groups: [["g1", "g2", "g3"], []] }, settings(), at(0)),
    ).toThrow();
  });

  it("refuses a non-open ticket", () => {
    const closed = { ...trio(), ticket: ticket({ id: "t_o", status: TicketStatus.CLOSED }) };
    expect(() =>
      planGroupedSplit(closed, { ...opts, groups: [["g1"], ["g2", "g3"]] }, settings(), at(0)),
    ).toThrow(/cannot split/);
  });
});
