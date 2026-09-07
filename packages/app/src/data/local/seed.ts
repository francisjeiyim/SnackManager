import type { LocalDb } from "./db";

const uuid = (): string => crypto.randomUUID();
const now = (): string => new Date().toISOString();

/** First-run data for autonomous mode: settings, a local admin, rooms, seats, products. */
export function seedLocalDb(db: LocalDb): void {
  const ts = now();

  db.run(
    `INSERT INTO "Settings" ("id","currency","defaultRatePerMinuteYen","graceMinutes","minChargeMinutes","timeRounding","defaultLocale","serviceDayCutoverHour","hourWarningMinutes","updatedAt")
     VALUES ('settings','JPY',10,0,0,'CEIL_MINUTE','ja',5,10,?)`,
    [ts],
  );

  db.run(
    `INSERT INTO "User" ("id","username","passwordHash","displayName","role","isActive","createdAt","updatedAt")
     VALUES (?,?,?,?,'ADMIN',1,?,?)`,
    [uuid(), "local", "-", "ローカル Admin", ts, ts],
  );

  const rooms = [
    {
      name: "メインホール Main Hall",
      width: 1200,
      height: 800,
      sort: 0,
      prefix: "T",
      rows: 2,
      cols: 4,
    },
    { name: "テラス Terrace", width: 900, height: 600, sort: 1, prefix: "P", rows: 1, cols: 4 },
  ];
  for (const room of rooms) {
    const roomId = uuid();
    db.run(
      `INSERT INTO "Room" ("id","name","width","height","background","sortOrder") VALUES (?,?,?,?,NULL,?)`,
      [roomId, room.name, room.width, room.height, room.sort],
    );
    let n = 1;
    for (let r = 0; r < room.rows; r++) {
      for (let c = 0; c < room.cols; c++) {
        db.run(
          `INSERT INTO "Seat" ("id","roomId","label","x","y","w","h","rotationDeg","shape","color","kind","isActive")
           VALUES (?,?,?,?,?,120,120,0,?,NULL,'PERMANENT',1)`,
          [
            uuid(),
            roomId,
            `${room.prefix}${n}`,
            120 + c * 220,
            120 + r * 240,
            c % 2 === 0 ? "RECT" : "ROUND",
          ],
        );
        n++;
      }
    }
  }

  const products: Array<[string, string, number, string]> = [
    ["生ビール Draft Beer", "Drinks", 600, "🍺"],
    ["ハイボール Highball", "Drinks", 500, "🥃"],
    ["レモンサワー Lemon Sour", "Drinks", 480, "🍋"],
    ["ウーロン茶 Oolong Tea", "Drinks", 300, "🍵"],
    ["コーラ Cola", "Drinks", 300, "🥤"],
    ["日本酒 Sake", "Drinks", 700, "🍶"],
    ["コーヒー Coffee", "Drinks", 400, "☕"],
    ["枝豆 Edamame", "Food", 400, "🫛"],
    ["唐揚げ Fried Chicken", "Food", 650, "🍗"],
    ["フライドポテト Fries", "Food", 500, "🍟"],
    ["餃子 Gyoza", "Food", 550, "🥟"],
    ["焼きそば Yakisoba", "Food", 700, "🍜"],
    ["刺身盛り Sashimi", "Food", 1200, "🍣"],
    ["おにぎり Onigiri", "Food", 250, "🍙"],
    ["アイス Ice Cream", "Dessert", 400, "🍨"],
    ["チーズケーキ Cheesecake", "Dessert", 550, "🍰"],
  ];
  products.forEach(([name, category, priceYen, emoji], i) => {
    db.run(
      `INSERT INTO "Product" ("id","name","category","priceYen","isActive","sortOrder","color","emoji")
       VALUES (?,?,?,?,1,?,NULL,?)`,
      [uuid(), name, category, priceYen, i, emoji],
    );
  });
}
