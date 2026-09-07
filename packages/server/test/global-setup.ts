import { execSync } from "node:child_process";
import { Client } from "pg";

const TEST_URL =
  process.env.DATABASE_URL_TEST ??
  "postgresql://snackmanager:snackmanager@localhost:5434/snackmanager_test?schema=public";

/** Create the test database if missing, then apply migrations. Runs once. */
export default async function globalSetup(): Promise<void> {
  const url = new URL(TEST_URL);
  const dbName = url.pathname.replace(/^\//, "").split("?")[0]!;

  const admin = new Client({
    host: url.hostname,
    port: Number(url.port || 5432),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: "postgres",
  });
  await admin.connect();
  const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
  if (exists.rowCount === 0) {
    await admin.query(`CREATE DATABASE "${dbName}"`);
  }
  await admin.end();

  execSync("pnpm exec prisma migrate deploy", {
    cwd: `${__dirname}/..`,
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: TEST_URL },
  });
}
