import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { ServiceEvent } from "@snackmanager/shared";
import { EventsGateway } from "../src/events/events.gateway";
import { bootTestApp, login, truncateAll, seedMinimal, type TestContext } from "./helpers";

const T0 = "2026-09-07T12:00:00.000Z";

describe("Staff management + guest assignment (e2e)", () => {
  let ctx: TestContext;
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    ctx = await bootTestApp();
    app = ctx.app;
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
  const srv = () => app.getHttpServer();

  async function createStaff(username: string, role = "SERVER") {
    const res = await auth(
      request(srv())
        .post("/api/users")
        .send({ username, password: "initial-pw-1", role, displayName: username, jobTitle: "Hall" }),
    ).expect(201);
    return res.body as { id: string; presence: string; jobTitle: string };
  }

  async function seatGuest(seatId: string) {
    const res = await auth(
      request(srv())
        .post("/api/guests/seat-in")
        .send({ roomId: ctx.seed.room.id, guests: [{ seatId }], arrivalAt: T0 }),
    ).expect(201);
    const ticketId = res.body.tickets[0].id as string;
    const one = await auth(request(srv()).get(`/api/tickets/${ticketId}`)).expect(200);
    return one.body.guests[0].id as string;
  }

  it("creates a staff member with a job title, absent by default", async () => {
    const s = await createStaff("marie");
    expect(s.jobTitle).toBe("Hall");
    expect(s.presence).toBe("ABSENT");
  });

  it("edits role and job, and toggles presence", async () => {
    const s = await createStaff("lea");
    const upd = await auth(
      request(srv()).patch(`/api/users/${s.id}`).send({ role: "CASHIER", jobTitle: "Bar" }),
    ).expect(200);
    expect(upd.body.role).toBe("CASHIER");
    expect(upd.body.jobTitle).toBe("Bar");

    const pres = await auth(
      request(srv()).patch(`/api/users/${s.id}/presence`).send({ presence: "PRESENT" }),
    ).expect(200);
    expect(pres.body.presence).toBe("PRESENT");
    expect(pres.body.presenceChangedAt).toBeTruthy();
  });

  it("resets a password and revokes the old sessions", async () => {
    const s = await createStaff("bob");
    const first = await request(srv())
      .post("/api/auth/login")
      .send({ username: "bob", password: "initial-pw-1" })
      .expect(201);
    const oldRefresh = first.body.refreshToken as string;

    await auth(
      request(srv()).post(`/api/users/${s.id}/password`).send({ password: "brand-new-pw-9" }),
    ).expect(201);

    await request(srv())
      .post("/api/auth/refresh")
      .send({ refreshToken: oldRefresh })
      .expect(401);
    await request(srv())
      .post("/api/auth/login")
      .send({ username: "bob", password: "brand-new-pw-9" })
      .expect(201);
  });

  it("hard-deletes a clean account but refuses one with recorded activity", async () => {
    const clean = await createStaff("temp");
    await auth(request(srv()).delete(`/api/users/${clean.id}`)).expect(200);

    const cashier = await createStaff("caissiere", "CASHIER");
    // give her an audit trail by acting as her
    await auth(
      request(srv()).patch(`/api/users/${cashier.id}/presence`).send({ presence: "PRESENT" }),
    );
    const cashierTok = (
      await request(srv())
        .post("/api/auth/login")
        .send({ username: "caissiere", password: "initial-pw-1" })
        .expect(201)
    ).body.accessToken as string;
    const gid = await seatGuest(ctx.seed.seats[0].id);
    await request(srv())
      .put(`/api/guests/${gid}/assignment`)
      .set("authorization", `Bearer ${cashierTok}`)
      .send({ userId: cashier.id })
      .expect(200);

    await auth(request(srv()).delete(`/api/users/${cashier.id}`)).expect(409);
  });

  it("protects the last admin and the current user", async () => {
    const admin = ctx.seed.admin;
    await auth(request(srv()).patch(`/api/users/${admin.id}`).send({ isActive: false })).expect(403);
    await auth(request(srv()).delete(`/api/users/${admin.id}`)).expect(403);
    await auth(request(srv()).patch(`/api/users/${admin.id}`).send({ role: "SERVER" })).expect(409);
  });

  it("assigns, reassigns and releases staff — keeping history", async () => {
    const a = await createStaff("alice");
    const b = await createStaff("bruno");
    for (const id of [a.id, b.id]) {
      await auth(request(srv()).patch(`/api/users/${id}/presence`).send({ presence: "PRESENT" }));
    }

    const gid = await seatGuest(ctx.seed.seats[0].id);

    await auth(request(srv()).put(`/api/guests/${gid}/assignment`).send({ userId: a.id })).expect(
      200,
    );
    let active = await auth(request(srv()).get("/api/guests/active")).expect(200);
    expect(active.body[0].assignment.userId).toBe(a.id);
    expect(active.body[0].assignment.staffName).toBe("alice");

    // reassign to bruno
    await auth(request(srv()).put(`/api/guests/${gid}/assignment`).send({ userId: b.id })).expect(
      200,
    );
    active = await auth(request(srv()).get("/api/guests/active")).expect(200);
    expect(active.body[0].assignment.userId).toBe(b.id);

    // one active row, one closed with REASSIGNED
    const rows = await ctx.prisma.guestAssignment.findMany({ where: { guestId: gid } });
    expect(rows).toHaveLength(2);
    expect(rows.filter((r) => r.endedAt == null)).toHaveLength(1);
    expect(rows.find((r) => r.endedReason === "REASSIGNED")).toBeTruthy();

    // guest leaves -> assignment closed GUEST_LEFT, history kept
    await auth(request(srv()).post(`/api/guests/${gid}/seat-out`)).expect(201);
    const after = await ctx.prisma.guestAssignment.findMany({ where: { guestId: gid } });
    expect(after).toHaveLength(2);
    expect(after.every((r) => r.endedAt != null)).toBe(true);
    expect(after.find((r) => r.endedReason === "GUEST_LEFT")).toBeTruthy();
  });

  it("assignable-staff lists only present, active staff", async () => {
    const p = await createStaff("present1");
    await createStaff("absent1");
    await auth(request(srv()).patch(`/api/users/${p.id}/presence`).send({ presence: "PRESENT" }));

    const res = await auth(request(srv()).get("/api/guests/assignable-staff")).expect(200);
    const names = (res.body as Array<{ username: string }>).map((u) => u.username);
    expect(names).toContain("present1");
    expect(names).not.toContain("absent1");
  });

  it("broadcasts user.updated and assignment.updated", async () => {
    const gateway = app.get(EventsGateway);
    const spy = jest.spyOn(gateway, "emitEvent").mockImplementation(() => undefined);
    try {
      const s = await createStaff("eventful");
      await auth(request(srv()).patch(`/api/users/${s.id}/presence`).send({ presence: "PRESENT" }));
      const gid = await seatGuest(ctx.seed.seats[1].id);
      await auth(request(srv()).put(`/api/guests/${gid}/assignment`).send({ userId: s.id }));

      const events = spy.mock.calls.map(([e]) => e);
      expect(events).toContain(ServiceEvent.USER_UPDATED);
      expect(events).toContain(ServiceEvent.ASSIGNMENT_UPDATED);
    } finally {
      spy.mockRestore();
    }
  });
});
