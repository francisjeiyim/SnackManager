import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import schemaSql from "./schema.sql?raw";
import { seedLocalDb } from "./seed";

/* eslint-disable @typescript-eslint/no-explicit-any -- wa-sqlite has loose types */

const DB_PATH = "/snackmanager.sqlite3";
const VFS_NAME = "snackmanager-opfs";
const KV_NAMESPACE = "local";

export type StorageKind = "opfs" | "kvvfs" | "memory";

export class LocalDb {
  constructor(
    private readonly sqlite3: any,
    private readonly handle: any,
    readonly kind: StorageKind,
    /** OPFS pool util — only present when `kind === "opfs"`. */
    readonly pool: any | null,
  ) {}

  exec(sql: string): void {
    this.handle.exec(sql);
  }

  run(sql: string, bind: unknown[] = []): void {
    this.handle.exec({ sql, bind });
  }

  all<T = Record<string, unknown>>(sql: string, bind: unknown[] = []): T[] {
    const rows: T[] = [];
    this.handle.exec({ sql, bind, rowMode: "object", callback: (r: T) => rows.push({ ...r }) });
    return rows;
  }

  get<T = Record<string, unknown>>(sql: string, bind: unknown[] = []): T | undefined {
    return this.all<T>(sql, bind)[0];
  }

  tx<T>(fn: () => T): T {
    this.handle.exec("BEGIN");
    try {
      const out = fn();
      this.handle.exec("COMMIT");
      return out;
    } catch (err) {
      try {
        this.handle.exec("ROLLBACK");
      } catch {
        /* ignore */
      }
      throw err;
    }
  }

  /** Serialize the whole database to a `.sqlite3` byte array. */
  exportBytes(): Uint8Array {
    return this.sqlite3.capi.sqlite3_js_db_export(this.handle);
  }

  /** Whether data survives a reload. */
  get persistent(): boolean {
    return this.kind !== "memory";
  }

  /** Drop the localStorage-backed store (kvvfs only). */
  clearKvStore(): void {
    try {
      this.sqlite3.capi.sqlite3_js_kvvfs_clear?.(KV_NAMESPACE);
    } catch {
      /* ignore */
    }
  }
}

let instance: Promise<LocalDb> | null = null;

export function getLocalDb(): Promise<LocalDb> {
  if (!instance) instance = init();
  return instance;
}

async function init(): Promise<LocalDb> {
  const sqlite3 = await sqlite3InitModule({ print: () => undefined, printErr: () => undefined });

  let handle: any;
  let pool: any = null;
  let kind: StorageKind;

  try {
    // Best: OPFS sync-access-handle pool — no worker, no COOP/COEP, unlimited.
    pool = await sqlite3.installOpfsSAHPoolVfs({ name: VFS_NAME });
    handle = new pool.OpfsSAHPoolDb(DB_PATH);
    kind = "opfs";
  } catch {
    try {
      // Fallback: localStorage-backed VFS — persists, ~5–10 MB cap.
      handle = new sqlite3.oo1.JsStorageDb(KV_NAMESPACE);
      kind = "kvvfs";
    } catch {
      // Last resort: transient in-memory DB (lost on reload).
      handle = new sqlite3.oo1.DB(":memory:", "c");
      kind = "memory";
    }
  }

  const db = new LocalDb(sqlite3, handle, kind, pool);
  db.exec(schemaSql);
  const seeded = db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM "Settings"`);
  if (!seeded || seeded.n === 0) seedLocalDb(db);
  return db;
}

/** Replace the on-disk database with `bytes`, then reload the app. */
export async function importLocalDb(bytes: Uint8Array): Promise<void> {
  const db = await getLocalDb();
  if (db.kind !== "opfs" || !db.pool) {
    throw new Error("import is only available with OPFS persistence");
  }
  await db.pool.importDb(DB_PATH, bytes);
  window.location.reload();
}

/** Wipe the local database and reload. */
export async function resetLocalDb(): Promise<void> {
  const db = await getLocalDb();
  if (db.kind === "opfs" && db.pool) {
    await db.pool.wipeFiles();
  } else if (db.kind === "kvvfs") {
    db.clearKvStore();
  }
  window.location.reload();
}
