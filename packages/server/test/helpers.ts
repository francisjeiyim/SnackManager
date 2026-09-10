import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as bcrypt from "bcrypt";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

export interface TestContext {
  app: INestApplication;
  prisma: PrismaService;
  seed: Awaited<ReturnType<typeof seedMinimal>>;
}

const TABLES = [
  "Payment",
  "TicketItem",
  "Guest",
  "Ticket",
  "TicketCounter",
  "Party",
  "Seat",
  "Room",
  "Product",
  "RefreshToken",
  "AuditLog",
  "User",
  "Settings",
];

export async function truncateAll(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`,
  );
}

export async function seedMinimal(prisma: PrismaService) {
  await prisma.settings.create({
    data: {
      id: "settings",
      defaultRatePerMinuteYen: 10,
      graceMinutes: 5,
      minChargeMinutes: 0,
      setMinutes: 90,
      setPriceYen: 2000,
      halfSetPriceYen: 1000,
    },
  });
  const admin = await prisma.user.create({
    data: {
      username: "admin",
      role: "ADMIN",
      passwordHash: await bcrypt.hash("admin1234", 8),
    },
  });
  const room = await prisma.room.create({ data: { name: "Hall", width: 1000, height: 700 } });
  const seats = await Promise.all(
    ["A1", "A2", "A3", "A4"].map((label, i) =>
      prisma.seat.create({
        data: { roomId: room.id, label, x: 100 + i * 150, y: 100, w: 100, h: 100 },
      }),
    ),
  );
  const beer = await prisma.product.create({
    data: { name: "Beer", category: "Drinks", priceYen: 600 },
  });
  const fries = await prisma.product.create({
    data: { name: "Fries", category: "Food", priceYen: 500 },
  });
  return { admin, room, seats, products: { beer, fries } };
}

export async function bootTestApp(): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix("api");
  await app.init();

  const prisma = app.get(PrismaService);
  await truncateAll(prisma);
  const seed = await seedMinimal(prisma);
  return { app, prisma, seed };
}

export async function login(app: INestApplication, username = "admin", password = "admin1234") {
  const server = app.getHttpServer();
  const { default: request } = await import("supertest");
  const res = await request(server)
    .post("/api/auth/login")
    .send({ username, password })
    .expect(201);
  return res.body.accessToken as string;
}
