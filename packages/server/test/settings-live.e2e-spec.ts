import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { ServiceEvent } from "@snackmanager/shared";
import { EventsGateway } from "../src/events/events.gateway";
import { bootTestApp, login, truncateAll, seedMinimal, type TestContext } from "./helpers";

describe("Settings live propagation (e2e)", () => {
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

  it("broadcasts settings.updated to every connected client when an admin saves settings", async () => {
    const gateway = app.get(EventsGateway);
    const spy = jest.spyOn(gateway, "emitEvent").mockImplementation(() => undefined);

    try {
      const res = await request(app.getHttpServer())
        .put("/api/settings")
        .set("authorization", `Bearer ${token}`)
        .send({ defaultRatePerMinuteYen: 25, hourWarningIntervalMinutes: 90 })
        .expect(200);

      expect(res.body.defaultRatePerMinuteYen).toBe(25);

      const call = spy.mock.calls.find(([event]) => event === ServiceEvent.SETTINGS_UPDATED);
      expect(call).toBeDefined();
      // namespace-wide (no room id) so cashier + server screens all get it
      expect(call?.[2]).toBeUndefined();
      expect((call?.[1] as { defaultRatePerMinuteYen: number }).defaultRatePerMinuteYen).toBe(25);
    } finally {
      spy.mockRestore();
    }
  });
});
