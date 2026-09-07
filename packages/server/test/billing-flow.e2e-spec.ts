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
    // 2 guests * 30 min * 10 yen = 600 ; products 1700
    expect(closed.body.timeYen).toBe(600);
    expect(closed.body.productsYen).toBe(1700);
    expect(closed.body.totalYen).toBe(2300);
    expect(closed.body.status).toBe("CLOSED");
    expect(closed.body.guests.every((g: { status: string }) => g.status === "CLOSED")).toBe(true);
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
