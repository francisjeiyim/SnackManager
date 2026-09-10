import { PrismaClient, SeatKind } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  // --- settings -----------------------------------------------------
  await prisma.settings.upsert({
    where: { id: "settings" },
    create: {
      id: "settings",
      defaultRatePerMinuteYen: 10,
      graceMinutes: 5,
      setMinutes: 90,
      setPriceYen: 2000,
      halfSetPriceYen: 1000,
      defaultLocale: "ja",
    },
    update: {},
  });

  // --- staff ------------------------------------------------------
  const staff: Array<[string, string, "ADMIN" | "CASHIER" | "SERVER", string]> = [
    [
      process.env.SEED_ADMIN_USERNAME ?? "admin",
      process.env.SEED_ADMIN_PASSWORD ?? "admin1234",
      "ADMIN",
      "管理者 Admin",
    ],
    ["caisse", "caisse1234", "CASHIER", "レジ Cashier"],
    ["service", "service1234", "SERVER", "ホール Server"],
  ];
  for (const [username, password, role, displayName] of staff) {
    const presence = role === "ADMIN" ? "PRESENT" : "ABSENT";
    await prisma.user.upsert({
      where: { username },
      create: {
        username,
        role,
        displayName,
        presence,
        passwordHash: await bcrypt.hash(password, 10),
      },
      update: { role, displayName },
    });
  }

  // --- rooms & seats -------------------------------------------
  const roomSpecs = [
    { name: "メインホール Main Hall", width: 1200, height: 800, sortOrder: 0, rows: 2, cols: 4 },
    { name: "テラス Terrace", width: 900, height: 600, sortOrder: 1, rows: 1, cols: 4 },
  ];

  for (const spec of roomSpecs) {
    const room = await prisma.room.upsert({
      where: { id: `seed-${spec.sortOrder}` },
      create: {
        id: `seed-${spec.sortOrder}`,
        name: spec.name,
        width: spec.width,
        height: spec.height,
        sortOrder: spec.sortOrder,
      },
      update: { name: spec.name },
    });

    let n = 1;
    for (let r = 0; r < spec.rows; r++) {
      for (let c = 0; c < spec.cols; c++) {
        const label = `${spec.sortOrder === 0 ? "T" : "P"}${n}`;
        await prisma.seat.upsert({
          where: { roomId_label: { roomId: room.id, label } },
          create: {
            roomId: room.id,
            label,
            x: 120 + c * 220,
            y: 120 + r * 240,
            w: 120,
            h: 120,
            shape: c % 2 === 0 ? "RECT" : "ROUND",
            kind: SeatKind.PERMANENT,
          },
          update: {},
        });
        n++;
      }
    }
  }

  // --- products ----------------------------------------------
  const products: Array<[string, string, number, string]> = [
    ["生ビール Draft Beer", "Drinks", 600, "🍺"],
    ["ハイボール Highball", "Drinks", 500, "🥃"],
    ["レモンサワー Lemon Sour", "Drinks", 480, "🍋"],
    ["ウーロン茶 Oolong Tea", "Drinks", 300, "🍵"],
    ["コーラ Cola", "Drinks", 300, "🥤"],
    ["赤ワイン Red Wine", "Drinks", 650, "🍷"],
    ["日本酒 Sake (1合)", "Drinks", 700, "🍶"],
    ["コーヒー Coffee", "Drinks", 400, "☕"],
    ["枝豆 Edamame", "Food", 400, "🫛"],
    ["唐揚げ Fried Chicken", "Food", 650, "🍗"],
    ["フライドポテト Fries", "Food", 500, "🍟"],
    ["餃子 Gyoza (6)", "Food", 550, "🥟"],
    ["焼きそば Yakisoba", "Food", 700, "🍜"],
    ["お好み焼き Okonomiyaki", "Food", 850, "🥞"],
    ["刺身盛り Sashimi Plate", "Food", 1200, "🍣"],
    ["サラダ Green Salad", "Food", 550, "🥗"],
    ["おにぎり Onigiri", "Food", 250, "🍙"],
    ["アイス Ice Cream", "Dessert", 400, "🍨"],
    ["チーズケーキ Cheesecake", "Dessert", 550, "🍰"],
    ["みたらし団子 Dango", "Dessert", 350, "🍡"],
  ];
  let order = 0;
  for (const [name, category, priceYen, emoji] of products) {
    await prisma.product.upsert({
      where: { id: `seed-p-${order}` },
      create: { id: `seed-p-${order}`, name, category, priceYen, emoji, sortOrder: order },
      update: { name, category, priceYen, emoji },
    });
    order++;
  }

  const counts = {
    users: await prisma.user.count(),
    rooms: await prisma.room.count(),
    seats: await prisma.seat.count(),
    products: await prisma.product.count(),
  };
  console.log("seed complete:", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
