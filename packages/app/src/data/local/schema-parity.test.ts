import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const prismaSrc = readFileSync(
  fileURLToPath(new URL("../../../../server/prisma/schema.prisma", import.meta.url)),
  "utf8",
);
const sqlSrc = readFileSync(fileURLToPath(new URL("./schema.sql", import.meta.url)), "utf8");

/** Prisma models → the scalar/enum columns they declare (relation fields dropped). */
function parsePrisma(src: string): Record<string, string[]> {
  const modelNames = [...src.matchAll(/^model\s+(\w+)\s*\{/gm)].map((m) => m[1]);
  const out: Record<string, string[]> = {};
  for (const block of src.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
    const name = block[1] as string;
    const body = block[2] ?? "";
    const cols: string[] = [];
    for (const raw of body.split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("//") || line.startsWith("@@")) continue;
      const m = line.match(/^(\w+)\s+([A-Za-z0-9_]+)/);
      if (!m) continue;
      const field = m[1] as string;
      const type = m[2] as string;
      if (modelNames.includes(type)) continue; // relation object field — no column
      cols.push(field);
    }
    out[name] = cols.sort();
  }
  return out;
}

/** CREATE TABLE statements → their column names. */
function parseSql(src: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const block of src.matchAll(/CREATE TABLE IF NOT EXISTS "(\w+)"\s*\(([\s\S]*?)\n\);/g)) {
    const name = block[1] as string;
    const body = block[2] ?? "";
    const cols: string[] = [];
    for (const raw of body.split("\n")) {
      const m = raw.trim().match(/^"(\w+)"\s+\S/);
      if (m) cols.push(m[1] as string);
    }
    out[name] = cols.sort();
  }
  return out;
}

describe("SQLite schema mirrors the Prisma schema", () => {
  const prisma = parsePrisma(prismaSrc);
  const sql = parseSql(sqlSrc);

  it("declares the same set of tables", () => {
    expect(Object.keys(sql).sort()).toEqual(Object.keys(prisma).sort());
  });

  for (const [table, prismaCols] of Object.entries(parsePrisma(prismaSrc))) {
    it(`table "${table}" has the same columns`, () => {
      expect(sql[table], `table ${table} missing from schema.sql`).toBeDefined();
      expect(sql[table]).toEqual(prismaCols);
    });
  }
});
