import { describe, expect, it } from "vitest";
import { computeTicketTotals, itemLineYen } from "./totals.js";
import { at, bundle, guest, item, settings, ticket } from "./fixtures.js";

describe("itemLineYen", () => {
  it("multiplies unit price by quantity", () => {
    expect(itemLineYen(item({ unitPriceYen: 300, quantity: 3 }))).toBe(900);
  });
  it("is zero for a voided line", () => {
    expect(itemLineYen(item({ unitPriceYen: 300, quantity: 3, voided: true }))).toBe(0);
  });
});

describe("computeTicketTotals", () => {
  it("sums time charges and product lines", () => {
    const b = bundle({
      guests: [
        guest({ id: "g1", arrivalAt: "2026-09-07T12:00:00.000Z", ratePerMinuteYenSnapshot: 10 }),
        guest({ id: "g2", arrivalAt: "2026-09-07T12:00:00.000Z", ratePerMinuteYenSnapshot: 10 }),
      ],
      items: [item({ unitPriceYen: 300, quantity: 2 }), item({ unitPriceYen: 500, quantity: 1 })],
    });
    const totals = computeTicketTotals(b, settings(), at(30));
    expect(totals.timeYen).toBe(600); // 2 guests * 30 min * 10
    expect(totals.productsYen).toBe(1100);
    expect(totals.totalYen).toBe(1700);
    expect(totals.perGuest).toHaveLength(2);
  });

  it("subtracts the ticket discount", () => {
    const b = bundle({
      ticket: ticket({ discountYen: 200 }),
      items: [item({ unitPriceYen: 1000, quantity: 1 })],
    });
    expect(computeTicketTotals(b, settings(), at(0)).totalYen).toBe(800);
  });

  it("ignores voided items", () => {
    const b = bundle({
      items: [
        item({ unitPriceYen: 300, quantity: 1 }),
        item({ unitPriceYen: 999, quantity: 1, voided: true }),
      ],
    });
    expect(computeTicketTotals(b, settings(), at(0)).productsYen).toBe(300);
  });
});
