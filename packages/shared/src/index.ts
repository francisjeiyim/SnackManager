/**
 * @snackmanager/shared — pure domain core.
 *
 * Types, enums, Zod schemas, money/time helpers and the billing engine
 * (minutes, charge, totals, close, merge, split). No I/O; runs identically in
 * Node (server) and the browser (autonomous mode).
 */
export const SHARED_VERSION = "0.1.0";

export * from "./enums.js";
export * from "./types.js";
export * from "./money.js";
export * from "./time.js";
export * from "./billing/index.js";
export * as schemas from "./schemas.js";
