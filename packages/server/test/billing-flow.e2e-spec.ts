import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { bootTestApp, login, truncateAll, seedMinimal, type TestContext } from "./helpers";

const T0 = "2026-09-07T12:00:00.000Z";
const at = (min: number): string => new Date(Date.parse(T0) + min * 60_000).toISOString();

describe("SnackManager billing flow (e2e)", () => {
  let ctx: TestContext;
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    ctx = await bootTestApp();
    app = ctx.app;
    token = await login(app);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateAll(ctx.prisma);
    ctx.seed = await seedMinimal(ctx.prisma);
    token = await login(app);
  });

  const auth = (t: request.Test) => t.set("authorization", `Bearer ${token}`);

  async function seatIn(seatIds: string[], separateTickets = false) {
    const res = await auth(
      request(app.getHttpServer())
        .post("/api/guests/seat-in")
        .send({
          roomId: ctx.seed.room.id,
          guests: seatIds.map((seatId) => ({ seatId })),
          separateTickets,
          arrivalAt: T0,
        }),
    ).expect(201);
    return res.body as { partyId: string; tickets: Array<{ id: string; number: number }> };
  }

  const addItem = (ticketId: string, productId: string, quantity = 1) =>
    auth(
      request(app.getHttpServer())
        .post(`/api/tickets/${ticketId}/items`)
        .send({ productId, quantity }),
    ).expect(201);

  const close = (ticketId: string, closedAt: string) =>
    auth(
      request(app.getHttpServer()).post(`/api/tickets/${ticketId}/close`).send({ closedAt }),
    ).expect(201);

  it("bills a group ticket as time + products", async () => {
    const { seats, products } = ctx.seed;
    const { tickets } = await seatIn([seats[0].id, seats[1].id]);
    const ticketId = tickets[0].id;

    await addItem(ticketId, products.beer.id, 2); // 1200
    await addItem(ticketId, products.fries.id, 1); // 500

    const closed = await close(ticketId, at(30));
    // 2 guests * 1 set (2000) = 4000 ; products 1700
    expect(closed.body.timeYen).toBe(4000);
    expect(closed.body.productsYen).toBe(1700);
    expect(closed.body.totalYen).toBe(5700);
    expect(closed.body.status).toBe("CLOSED");
    expect(closed.body.guests.every((g: { status: string }) => g.status === "CLOSED")).toBe(true);
  });

  it("charges only the first set until an extension is validated, with a grace window", async () => {
    const { seats } = ctx.seed;

    // within the 5-min grace window → nothing
    const a = await seatIn([seats[2].id]);
    const closedA = await close(a.tickets[0].id, at(3));
    expect(closedA.body.timeYen).toBe(0);

    // 100 min, nothing validated → still just the first full set (2000)
    const b = await seatIn([seats[3].id]);
    const closedB = await close(b.tickets[0].id, at(100));
    expect(closedB.body.timeYen).toBe(2000);
    expect(closedB.body.guests[0].timeChargeYen).toBe(2000);
  });

  it("bills a typed extension block once an operator validates it, and can undo it", async () => {
    const { seats } = ctx.seed;
    const { tickets } = await seatIn([seats[0].id]);
    const one = await auth(
      request(app.getHttpServer()).get(`/api/tickets/${tickets[0].id}`),
    ).expect(200);
    const guestId = one.body.guests[0].id as string;

    // backdate the arrival so ~200 min have elapsed (well past one set)
    await ctx.prisma.guest.update({
      where: { id: guestId },
      data: { arrivalAt: new Date(Date.now() - 200 * 60_000) },
    });

    // running total: first set only; the guest is overdue but nothing extra bills
    let live = await auth(request(app.getHttpServer()).get("/api/tickets/live")).expect(200);
    expect(live.body[0].live.timeYen).toBe(2000);
    expect(live.body[0].live.perGuest[0].overdueMinutes).toBeGreaterThan(0);

    // validate a full-set extension → set + set
    await auth(
      request(app.getHttpServer()).post(`/api/guests/${guestId}/extend`).send({ kind: "SET" }),
    ).expect(201);
    live = await auth(request(app.getHttpServer()).get("/api/tickets/live")).expect(200);
    expect(live.body[0].live.timeYen).toBe(4000);

    // add a half-set on top → set + set + half-set
    await auth(
      request(app.getHttpServer()).post(`/api/guests/${guestId}/extend`).send({ kind: "HALF" }),
    ).expect(201);
    live = await auth(request(app.getHttpServer()).get("/api/tickets/live")).expect(200);
    expect(live.body[0].live.timeYen).toBe(5000);

    // undo the last (the half-set) → back to set + set
    await auth(
      request(app.getHttpServer()).delete(`/api/guests/${guestId}/extension`),
    ).expect(200);
    live = await auth(request(app.getHttpServer()).get("/api/tickets/live")).expect(200);
    expect(live.body[0].live.timeYen).toBe(4000);

    // close covering the remaining overdue time with a half-set → 5000, frozen
    const closed = await auth(
      request(app.getHttpServer())
        .post(`/api/tickets/${tickets[0].id}/close`)
        .send({ overdueExtension: "HALF" }),
    ).expect(201);
    expect(closed.body.timeYen).toBe(5000);
    expect(closed.body.guests[0].timeChargeYen).toBe(5000);
  });

  it("frees the seat once the ticket is closed", async () => {
    const { seats } = ctx.seed;
    const { tickets } = await seatIn([seats[0].id]);
    let active = await auth(request(app.getHttpServer()).get("/api/guests/active")).expect(200);
    expect(active.body).toHaveLength(1);

    await close(tickets[0].id, at(10));
    active = await auth(request(app.getHttpServer()).get("/api/guests/active")).expect(200);
    expect(active.body).toHaveLength(0);

    // seat is reusable
    await seatIn([seats[0].id]);
  });

  it("rejects seating an already-occupied seat", async () => {
    const { seats } = ctx.seed;
    await seatIn([seats[0].id]);
    await auth(
      request(app.getHttpServer())
        .post("/api/guests/seat-in")
        .send({ roomId: ctx.seed.room.id, guests: [{ seatId: seats[0].id }], arrivalAt: T0 }),
    ).expect(409);
  });

  it("merges two individual tickets into one", async () => {
    const { seats, products } = ctx.seed;
    const { tickets } = await seatIn([seats[0].id, seats[1].id], true);
    expect(tickets).toHaveLength(2);
    await addItem(tickets[0].id, products.beer.id, 1); // 600
    await addItem(tickets[1].id, products.fries.id, 1); // 500

    const merged = await auth(
      request(app.getHttpServer())
        .post("/api/tickets/merge")
        .send({ targetTicketId: tickets[0].id, sourceTicketIds: [tickets[1].id] }),
    ).expect(201);

    expect(merged.body.productsYen).toBe(1100);
    expect(merged.body.guests).toHaveLength(2);

    const source = await auth(
      request(app.getHttpServer()).get(`/api/tickets/${tickets[1].id}`),
    ).expect(200);
    expect(source.body.status).toBe("VOID");
    expect(source.body.mergedIntoTicketId).toBe(tickets[0].id);
  });

  it("splits a ticket by item onto a new ticket", async () => {
    const { seats, products } = ctx.seed;
    const { tickets } = await seatIn([seats[0].id, seats[1].id]);
    const ticketId = tickets[0].id;
    const beerRes = await addItem(ticketId, products.beer.id, 1); // 600
    await addItem(ticketId, products.fries.id, 1); // 500

    const full = await auth(request(app.getHttpServer()).get(`/api/tickets/${ticketId}`)).expect(
      200,
    );
    const beerItem = full.body.items.find(
      (i: { nameSnapshot: string }) => i.nameSnapshot === "Beer",
    );
    const guest2 = full.body.guests[1];
    expect(beerRes.body.productsYen).toBe(600);

    const split = await auth(
      request(app.getHttpServer())
        .post(`/api/tickets/${ticketId}/split`)
        .send({ mode: "ITEMIZED", guestIds: [guest2.id], itemIds: [beerItem.id] }),
    ).expect(201);

    expect(split.body.mode).toBe("ITEMIZED");
    expect(split.body.newTicket.items).toHaveLength(1);
    expect(split.body.newTicket.guests).toHaveLength(1);
    expect(split.body.newTicket.splitFromTicketId).toBe(ticketId);
    expect(split.body.originTicket.items).toHaveLength(1);
    expect(split.body.originTicket.guests).toHaveLength(1);
  });

  it("splits a closed-out total into equal shares", async () => {
    const { seats, products } = ctx.seed;
    const { tickets } = await seatIn([seats[0].id]);
    const ticketId = tickets[0].id;
    await addItem(ticketId, products.beer.id, 1); // 600
    // leave open: even split works on the live total

    const res = await auth(
      request(app.getHttpServer())
        .post(`/api/tickets/${ticketId}/split`)
        .send({ mode: "EVEN", parts: 3 }),
    ).expect(201);

    expect(res.body.mode).toBe("EVEN");
    expect(res.body.shares).toHaveLength(3);
    expect(res.body.shares.reduce((a: number, b: number) => a + b, 0)).toBe(res.body.total);
  });

  it("takes payment and marks the ticket PAID", async () => {
    const { seats, products } = ctx.seed;
    const { tickets } = await seatIn([seats[0].id]);
    const ticketId = tickets[0].id;
    await addItem(ticketId, products.beer.id, 1);
    const closed = await close(ticketId, at(10)); // time 100 + 600 = 700

    const partial = await auth(
      request(app.getHttpServer())
        .post(`/api/tickets/${ticketId}/payments`)
        .send({ amountYen: 300, method: "CASH" }),
    ).expect(201);
    expect(partial.body.balanceYen).toBe(closed.body.totalYen - 300);
    expect(partial.body.status).toBe("CLOSED");

    const paid = await auth(
      request(app.getHttpServer())
        .post(`/api/tickets/${ticketId}/payments`)
        .send({ amountYen: closed.body.totalYen - 300, method: "CARD" }),
    ).expect(201);
    expect(paid.body.status).toBe("PAID");
    expect(paid.body.balanceYen).toBe(0);
  });

  it("refuses payment on an open ticket", async () => {
    const { seats } = ctx.seed;
    const { tickets } = await seatIn([seats[0].id]);
    await auth(
      request(app.getHttpServer())
        .post(`/api/tickets/${tickets[0].id}/payments`)
        .send({ amountYen: 100, method: "CASH" }),
    ).expect(409);
  });

  it("keeps a closed-unpaid ticket recallable, then lets it be paid or written off", async () => {
    const { seats } = ctx.seed;

    // ticket A — closed, never paid → shows up in /tickets/unpaid, gets paid later
    const a = await seatIn([seats[0].id]);
    await close(a.tickets[0].id, at(10));
    // ticket B — closed, never paid → written off
    const b = await seatIn([seats[1].id]);
    await close(b.tickets[0].id, at(10));

    let unpaid = await auth(request(app.getHttpServer()).get("/api/tickets/unpaid")).expect(200);
    const ids = unpaid.body.map((tk: { id: string }) => tk.id).sort();
    expect(ids).toEqual([a.tickets[0].id, b.tickets[0].id].sort());
    // seats are already free even though payment is pending
    const active = await auth(request(app.getHttpServer()).get("/api/guests/active")).expect(200);
    expect(active.body).toHaveLength(0);

    // pay A in full → leaves the unpaid list as PAID
    const aTotal = unpaid.body.find((tk: { id: string }) => tk.id === a.tickets[0].id).totalYen;
    const paidA = await auth(
      request(app.getHttpServer())
        .post(`/api/tickets/${a.tickets[0].id}/payments`)
        .send({ amountYen: aTotal, method: "CASH" }),
    ).expect(201);
    expect(paidA.body.status).toBe("PAID");

    // write B off → status UNPAID, leaves the unpaid list
    const off = await auth(
      request(app.getHttpServer()).post(`/api/tickets/${b.tickets[0].id}/writeoff`),
    ).expect(201);
    expect(off.body.status).toBe("UNPAID");

    unpaid = await auth(request(app.getHttpServer()).get("/api/tickets/unpaid")).expect(200);
    expect(unpaid.body).toHaveLength(0);

    // a written-off ticket cannot be written off again, but can still be paid
    await auth(
      request(app.getHttpServer()).post(`/api/tickets/${b.tickets[0].id}/writeoff`),
    ).expect(409);
    const bTotal = off.body.totalYen;
    const paidB = await auth(
      request(app.getHttpServer())
        .post(`/api/tickets/${b.tickets[0].id}/payments`)
        .send({ amountYen: bTotal, method: "CASH" }),
    ).expect(201);
    expect(paidB.body.status).toBe("PAID");
  });

  it("splits a ticket by guest groups into new tickets", async () => {
    const { seats, products } = ctx.seed;
    const { tickets } = await seatIn([seats[0].id, seats[1].id, seats[2].id]);
    const ticketId = tickets[0].id;
    await addItem(ticketId, products.beer.id, 1); // shared, no guestId

    const full = await auth(request(app.getHttpServer()).get(`/api/tickets/${ticketId}`)).expect(
      200,
    );
    const [g1, g2, g3] = full.body.guests as Array<{ id: string }>;

    const res = await auth(
      request(app.getHttpServer())
        .post(`/api/tickets/${ticketId}/split`)
        .send({ mode: "GROUPS", groups: [[g1.id], [g2.id, g3.id]] }),
    ).expect(201);

    expect(res.body.mode).toBe("GROUPS");
    expect(res.body.tickets).toHaveLength(2);
    expect(res.body.tickets[0].id).toBe(ticketId); // group 0 keeps the origin
    expect(res.body.tickets[0].guests).toHaveLength(1);
    expect(res.body.tickets[1].guests).toHaveLength(2);
    expect(res.body.tickets[1].splitFromTicketId).toBe(ticketId);
    // shared beer stayed with group 0
    expect(res.body.tickets[0].items).toHaveLength(1);
    expect(res.body.tickets[1].items).toHaveLength(0);

    // seats untouched — everyone still seated
    const active = await auth(request(app.getHttpServer()).get("/api/guests/active")).expect(200);
    expect(active.body).toHaveLength(3);
  });

  it("swaps two guests' seats without touching their timers", async () => {
    const { seats } = ctx.seed;
    const a = await seatIn([seats[0].id]);
    const b = await seatIn([seats[1].id]);
    const ga = (
      await auth(request(app.getHttpServer()).get(`/api/tickets/${a.tickets[0].id}`)).expect(200)
    ).body.guests[0];
    const gb = (
      await auth(request(app.getHttpServer()).get(`/api/tickets/${b.tickets[0].id}`)).expect(200)
    ).body.guests[0];

    await auth(
      request(app.getHttpServer())
        .patch(`/api/guests/${ga.id}/move`)
        .send({ toSeatId: seats[1].id }),
    ).expect(200);

    const rows = await ctx.prisma.guest.findMany({ where: { id: { in: [ga.id, gb.id] } } });
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(byId[ga.id].seatId).toBe(seats[1].id);
    expect(byId[gb.id].seatId).toBe(seats[0].id);
    expect(byId[ga.id].arrivalAt.toISOString()).toBe(ga.arrivalAt);
    expect(byId[gb.id].arrivalAt.toISOString()).toBe(gb.arrivalAt);
  });

  it("lets one guest leave a shared ticket early", async () => {
    const { seats } = ctx.seed;
    const { tickets } = await seatIn([seats[0].id, seats[1].id]);
    const ticketId = tickets[0].id;
    const full = await auth(request(app.getHttpServer()).get(`/api/tickets/${ticketId}`)).expect(
      200,
    );
    const [g1, g2] = full.body.guests as Array<{ id: string }>;

    await auth(request(app.getHttpServer()).post(`/api/guests/${g1.id}/seat-out`)).expect(201);

    const g1Row = await ctx.prisma.guest.findUniqueOrThrow({ where: { id: g1.id } });
    expect(g1Row.status).toBe("CLOSED");
    expect(g1Row.billedMinutes).not.toBeNull();

    // ticket still open, g2 still running, g1's seat free
    const after = await auth(request(app.getHttpServer()).get(`/api/tickets/${ticketId}`)).expect(
      200,
    );
    expect(after.body.status).toBe("OPEN");
    const active = await auth(request(app.getHttpServer()).get("/api/guests/active")).expect(200);
    expect(active.body.map((g: { id: string }) => g.id)).toEqual([g2.id]);
  });

  it("puts the seat label on each guest of a ticket", async () => {
    const { seats } = ctx.seed;
    const { tickets } = await seatIn([seats[0].id]);
    const full = await auth(
      request(app.getHttpServer()).get(`/api/tickets/${tickets[0].id}`),
    ).expect(200);
    expect(full.body.guests[0].seatLabel).toBe(seats[0].label);
  });

  it("renames a guest at any time", async () => {
    const { seats } = ctx.seed;
    const { tickets } = await seatIn([seats[0].id]);
    const full = await auth(
      request(app.getHttpServer()).get(`/api/tickets/${tickets[0].id}`),
    ).expect(200);
    const guestId = full.body.guests[0].id;

    await auth(
      request(app.getHttpServer()).patch(`/api/guests/${guestId}`).send({ displayName: "Aïcha" }),
    ).expect(200);

    const after = await auth(
      request(app.getHttpServer()).get(`/api/tickets/${tickets[0].id}`),
    ).expect(200);
    expect(after.body.guests[0].displayName).toBe("Aïcha");
  });

  it("filters ticket history by a service-day range", async () => {
    const { seats } = ctx.seed;
    const { tickets } = await seatIn([seats[0].id]);
    // Derive the day from the ticket itself (seatIn uses a fixed arrivalAt, so
    // the wall clock is not a reliable stand-in for its service day).
    const one = await auth(
      request(app.getHttpServer()).get(`/api/tickets/${tickets[0].id}`),
    ).expect(200);
    const today = one.body.serviceDay as string;

    const inRange = await auth(
      request(app.getHttpServer()).get(`/api/tickets?from=${today}&to=${today}`),
    ).expect(200);
    expect(inRange.body.length).toBeGreaterThan(0);

    const outOfRange = await auth(
      request(app.getHttpServer()).get("/api/tickets?from=2000-01-01&to=2000-01-02"),
    ).expect(200);
    expect(outOfRange.body).toHaveLength(0);
  });

  it("enforces role permissions (SERVER cannot close)", async () => {
    const { seats } = ctx.seed;
    await ctx.prisma.user.create({
      data: {
        username: "srv",
        role: "SERVER",
        passwordHash: await (await import("bcrypt")).hash("srv12345", 8),
      },
    });
    const srvToken = await login(app, "srv", "srv12345");
    const { tickets } = await seatIn([seats[0].id]);

    await request(app.getHttpServer())
      .post(`/api/tickets/${tickets[0].id}/close`)
      .set("authorization", `Bearer ${srvToken}`)
      .send({})
      .expect(403);
  });
});
