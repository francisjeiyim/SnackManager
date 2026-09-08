-- SnackManager — SQLite schema for autonomous (in-browser) mode.
-- Mirrors packages/server/prisma/schema.prisma. A parity test
-- (schema-parity.test.ts) fails if a table/column drifts.
--
-- Types: DateTime -> TEXT (ISO-8601), Boolean -> INTEGER (0/1),
-- Int -> INTEGER, Float -> REAL, Json -> TEXT. Enums -> TEXT.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS "Settings" (
  "id" TEXT PRIMARY KEY,
  "currency" TEXT NOT NULL DEFAULT 'JPY',
  "defaultRatePerMinuteYen" INTEGER NOT NULL DEFAULT 10,
  "graceMinutes" INTEGER NOT NULL DEFAULT 0,
  "minChargeMinutes" INTEGER NOT NULL DEFAULT 0,
  "timeRounding" TEXT NOT NULL DEFAULT 'CEIL_MINUTE',
  "defaultLocale" TEXT NOT NULL DEFAULT 'ja',
  "serviceDayCutoverHour" INTEGER NOT NULL DEFAULT 5,
  "hourWarningIntervalMinutes" INTEGER NOT NULL DEFAULT 60,
  "hourWarningMinutes" INTEGER NOT NULL DEFAULT 10,
  "updatedAt" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT PRIMARY KEY,
  "username" TEXT NOT NULL UNIQUE,
  "passwordHash" TEXT NOT NULL,
  "displayName" TEXT,
  "jobTitle" TEXT,
  "role" TEXT NOT NULL DEFAULT 'SERVER',
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "presence" TEXT NOT NULL DEFAULT 'ABSENT',
  "presenceChangedAt" TEXT,
  "deletedAt" TEXT,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "RefreshToken" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "expiresAt" TEXT NOT NULL,
  "revokedAt" TEXT,
  "createdAt" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "Room" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "width" INTEGER NOT NULL DEFAULT 1200,
  "height" INTEGER NOT NULL DEFAULT 800,
  "background" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS "Seat" (
  "id" TEXT PRIMARY KEY,
  "roomId" TEXT NOT NULL REFERENCES "Room"("id") ON DELETE CASCADE,
  "label" TEXT NOT NULL,
  "x" REAL NOT NULL DEFAULT 0,
  "y" REAL NOT NULL DEFAULT 0,
  "w" REAL NOT NULL DEFAULT 80,
  "h" REAL NOT NULL DEFAULT 80,
  "rotationDeg" REAL NOT NULL DEFAULT 0,
  "shape" TEXT NOT NULL DEFAULT 'RECT',
  "color" TEXT,
  "kind" TEXT NOT NULL DEFAULT 'PERMANENT',
  "isActive" INTEGER NOT NULL DEFAULT 1,
  UNIQUE ("roomId", "label")
);

CREATE TABLE IF NOT EXISTS "Party" (
  "id" TEXT PRIMARY KEY,
  "label" TEXT,
  "arrivalAt" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "Guest" (
  "id" TEXT PRIMARY KEY,
  "seatId" TEXT NOT NULL REFERENCES "Seat"("id"),
  "roomId" TEXT NOT NULL REFERENCES "Room"("id"),
  "partyId" TEXT REFERENCES "Party"("id"),
  "displayName" TEXT,
  "arrivalAt" TEXT NOT NULL,
  "closedAt" TEXT,
  "ratePerMinuteYenSnapshot" INTEGER NOT NULL,
  "billedMinutes" INTEGER,
  "timeChargeYen" INTEGER,
  "ticketId" TEXT REFERENCES "Ticket"("id"),
  "status" TEXT NOT NULL DEFAULT 'SEATED',
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "GuestAssignment" (
  "id" TEXT PRIMARY KEY,
  "guestId" TEXT NOT NULL REFERENCES "Guest"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"("id"),
  "assignedByUserId" TEXT REFERENCES "User"("id"),
  "assignedAt" TEXT NOT NULL,
  "endedAt" TEXT,
  "endedReason" TEXT
);

CREATE TABLE IF NOT EXISTS "Product" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "category" TEXT,
  "priceYen" INTEGER NOT NULL,
  "isActive" INTEGER NOT NULL DEFAULT 1,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "color" TEXT,
  "emoji" TEXT
);

CREATE TABLE IF NOT EXISTS "Ticket" (
  "id" TEXT PRIMARY KEY,
  "number" INTEGER NOT NULL,
  "serviceDay" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "openedAt" TEXT NOT NULL,
  "closedAt" TEXT,
  "paidAt" TEXT,
  "notes" TEXT,
  "discountYen" INTEGER NOT NULL DEFAULT 0,
  "timeYen" INTEGER NOT NULL DEFAULT 0,
  "productsYen" INTEGER NOT NULL DEFAULT 0,
  "totalYen" INTEGER NOT NULL DEFAULT 0,
  "paidYen" INTEGER NOT NULL DEFAULT 0,
  "splitFromTicketId" TEXT,
  "mergedIntoTicketId" TEXT,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL,
  UNIQUE ("serviceDay", "number")
);

CREATE TABLE IF NOT EXISTS "TicketItem" (
  "id" TEXT PRIMARY KEY,
  "ticketId" TEXT NOT NULL REFERENCES "Ticket"("id") ON DELETE CASCADE,
  "productId" TEXT REFERENCES "Product"("id"),
  "nameSnapshot" TEXT NOT NULL,
  "unitPriceYen" INTEGER NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "guestId" TEXT REFERENCES "Guest"("id"),
  "addedAt" TEXT NOT NULL,
  "addedByUserId" TEXT REFERENCES "User"("id"),
  "voided" INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS "Payment" (
  "id" TEXT PRIMARY KEY,
  "ticketId" TEXT NOT NULL REFERENCES "Ticket"("id") ON DELETE CASCADE,
  "amountYen" INTEGER NOT NULL,
  "method" TEXT NOT NULL,
  "paidAt" TEXT NOT NULL,
  "receivedByUserId" TEXT REFERENCES "User"("id"),
  "reference" TEXT
);

CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" TEXT PRIMARY KEY,
  "at" TEXT NOT NULL,
  "userId" TEXT REFERENCES "User"("id"),
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "dataJson" TEXT
);

CREATE TABLE IF NOT EXISTS "TicketCounter" (
  "serviceDay" TEXT PRIMARY KEY,
  "lastNumber" INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS "Seat_roomId_idx" ON "Seat" ("roomId");
CREATE INDEX IF NOT EXISTS "Guest_ticketId_idx" ON "Guest" ("ticketId");
CREATE INDEX IF NOT EXISTS "Guest_status_idx" ON "Guest" ("status");
CREATE INDEX IF NOT EXISTS "GuestAssignment_guestId_idx" ON "GuestAssignment" ("guestId");
CREATE INDEX IF NOT EXISTS "GuestAssignment_userId_idx" ON "GuestAssignment" ("userId");
CREATE INDEX IF NOT EXISTS "GuestAssignment_endedAt_idx" ON "GuestAssignment" ("endedAt");
CREATE INDEX IF NOT EXISTS "TicketItem_ticketId_idx" ON "TicketItem" ("ticketId");
CREATE INDEX IF NOT EXISTS "Payment_ticketId_idx" ON "Payment" ("ticketId");
CREATE INDEX IF NOT EXISTS "Ticket_status_idx" ON "Ticket" ("status");
