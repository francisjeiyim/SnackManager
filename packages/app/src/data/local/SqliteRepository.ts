import {
  computeGuestCharge,
  computeTicketTotals,
  planClose,
  planEvenSplit,
  planGroupedSplit,
  planItemizedSplit,
  planMerge,
  BillingError,
  type AddItemInput,
  type BillingSettings,
  type MergeInput,
  type PaymentInput,
  type ProductInput,
  type RoomInput,
  type SeatInInput,
  type SeatInput,
  type SeatPatch,
  type SettingsUpdateInput,
  type StaffPresence,
  type TicketBundle,
  type TicketPatchInput,
  type UserCreateInput,
  type UserUpdateInput,
} from "@snackmanager/shared";
import { serviceDayOf } from "../../lib/serviceDay";
import type {
  PaymentResult,
  RoomWithSeats,
  SeatInResult,
  ServiceListener,
  SnackRepository,
  SplitResult,
  TicketView,
} from "../repository";
import { getLocalDb, type LocalDb } from "./db";
import {
  toBillingSettings,
  toGuest,
  toItem,
  toPayment,
  toProduct,
  toRoom,
  toSeat,
  toSettings,
  toTicket,
  toUser,
} from "./rows";

const uuid = (): string => crypto.randomUUID();
const nowIso = (): string => new Date().toISOString();
const CHANNEL = "snackmanager-service";

/** Guest columns + the seat label and the active staff assignment (all derived). */
const GUEST_SELECT = `SELECT g.*, s."label" AS "seatLabel",
    a."id" AS "assignmentId", a."userId" AS "assignmentUserId",
    a."assignedAt" AS "assignmentAssignedAt",
    COALESCE(NULLIF(TRIM(u."displayName"), ''), u."username") AS "assignmentStaffName"
  FROM "Guest" g
  LEFT JOIN "Seat" s ON s."id" = g."seatId"
  LEFT JOIN "GuestAssignment" a ON a."guestId" = g."id" AND a."endedAt" IS NULL
  LEFT JOIN "User" u ON u."id" = a."userId"`;

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export class SqliteRepository implements SnackRepository {
  readonly mode = "autonomous" as const;
  private readonly ready: Promise<LocalDb> = getLocalDb();
  private readonly listeners = new Set<ServiceListener>();
  private channel: BroadcastChannel | null = null;

  // --- infra ---------------------------------------------------------

  private emit(event: string, payload: unknown): void {
    for (const l of this.listeners) l(event, payload);
    this.channel?.postMessage({ event, payload });
  }

  subscribe(listener: ServiceListener): () => void {
    this.listeners.add(listener);
    if (!this.channel && typeof BroadcastChannel !== "undefined") {
      this.channel = new BroadcastChannel(CHANNEL);
      this.channel.onmessage = (e: MessageEvent<{ event: string; payload: unknown }>) => {
        for (const l of this.listeners) l(e.data.event, e.data.payload);
      };
    }
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.channel?.close();
        this.channel = null;
      }
    };
  }

  private async settings(): Promise<BillingSettings> {
    const db = await this.ready;
    return toBillingSettings(db.get(`SELECT * FROM "Settings" WHERE "id"='settings'`) ?? {});
  }

  private bundle(db: LocalDb, ticketId: string): TicketBundle {
    const ticket = db.get(`SELECT * FROM "Ticket" WHERE "id"=?`, [ticketId]);
    if (!ticket) throw new BillingError(`ticket ${ticketId} not found`, "NOT_FOUND");
    return {
      ticket: toTicket(ticket),
      guests: db
        .all(`${GUEST_SELECT} WHERE g."ticketId"=? ORDER BY g."arrivalAt"`, [ticketId])
        .map(toGuest),
      items: db
        .all(`SELECT * FROM "TicketItem" WHERE "ticketId"=? ORDER BY "addedAt"`, [ticketId])
        .map(toItem),
    };
  }

  private present(db: LocalDb, ticketId: string, settings: BillingSettings): TicketView {
    const b = this.bundle(db, ticketId);
    const payments = db
      .all(`SELECT * FROM "Payment" WHERE "ticketId"=? ORDER BY "paidAt"`, [ticketId])
      .map(toPayment);
    return {
      ...b.ticket,
      guests: b.guests,
      items: b.items,
      payments,
      live: computeTicketTotals(b, settings, new Date()),
    };
  }

  private recompute(db: LocalDb, ticketId: string, settings: BillingSettings): void {
    const b = this.bundle(db, ticketId);
    const totals = computeTicketTotals(b, settings, new Date());
    db.run(
      `UPDATE "Ticket" SET "timeYen"=?,"productsYen"=?,"totalYen"=?,"updatedAt"=? WHERE "id"=?`,
      [totals.timeYen, totals.productsYen, totals.totalYen, nowIso(), ticketId],
    );
  }

  private allocNumber(db: LocalDb, serviceDay: string): number {
    db.run(
      `INSERT INTO "TicketCounter" ("serviceDay","lastNumber") VALUES (?,1)
       ON CONFLICT("serviceDay") DO UPDATE SET "lastNumber"="lastNumber"+1`,
      [serviceDay],
    );
    const row = db.get<{ n: number }>(
      `SELECT "lastNumber" AS n FROM "TicketCounter" WHERE "serviceDay"=?`,
      [serviceDay],
    );
    return row?.n ?? 1;
  }

  private audit(
    db: LocalDb,
    action: string,
    entityType: string,
    entityId: string,
    data?: unknown,
  ): void {
    db.run(
      `INSERT INTO "AuditLog" ("id","at","userId","action","entityType","entityId","dataJson")
       VALUES (?,?,NULL,?,?,?,?)`,
      [uuid(), nowIso(), action, entityType, entityId, data == null ? null : JSON.stringify(data)],
    );
  }

  // --- settings ----------------------------------------------------

  async getSettings() {
    const db = await this.ready;
    return toSettings(db.get(`SELECT * FROM "Settings" WHERE "id"='settings'`) ?? {});
  }

  async updateSettings(patch: SettingsUpdateInput) {
    const db = await this.ready;
    const cols = Object.keys(patch) as (keyof SettingsUpdateInput)[];
    if (cols.length) {
      db.run(
        `UPDATE "Settings" SET ${cols.map((c) => `"${c}"=?`).join(",")},"updatedAt"=? WHERE "id"='settings'`,
        [...cols.map((c) => patch[c] as unknown), nowIso()],
      );
    }
    this.emit("settings.updated", null);
    return this.getSettings();
  }

  // --- rooms / seats --------------------------------------------

  async listRooms(): Promise<RoomWithSeats[]> {
    const db = await this.ready;
    return db.all(`SELECT * FROM "Room" ORDER BY "sortOrder"`).map((r) => ({
      ...toRoom(r),
      seats: db
        .all(`SELECT * FROM "Seat" WHERE "roomId"=? ORDER BY "label"`, [String(r.id)])
        .map(toSeat),
    }));
  }

  async createRoom(input: RoomInput) {
    const db = await this.ready;
    const id = uuid();
    db.run(
      `INSERT INTO "Room" ("id","name","width","height","background","sortOrder") VALUES (?,?,?,?,?,?)`,
      [id, input.name, input.width, input.height, input.background ?? null, input.sortOrder ?? 0],
    );
    this.emit("room.updated", { id });
    return toRoom(db.get(`SELECT * FROM "Room" WHERE "id"=?`, [id]) ?? {});
  }

  async updateRoom(id: string, patch: Partial<RoomInput>) {
    const db = await this.ready;
    this.setColumns(db, "Room", id, patch);
    this.emit("room.updated", { id });
    return toRoom(db.get(`SELECT * FROM "Room" WHERE "id"=?`, [id]) ?? {});
  }

  async deleteRoom(id: string) {
    const db = await this.ready;
    db.run(`DELETE FROM "Room" WHERE "id"=?`, [id]);
    this.emit("room.updated", { id, deleted: true });
  }

  async createSeat(input: SeatInput) {
    const db = await this.ready;
    const id = uuid();
    db.run(
      `INSERT INTO "Seat" ("id","roomId","label","x","y","w","h","rotationDeg","shape","color","kind","isActive")
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id,
        input.roomId,
        input.label,
        input.x,
        input.y,
        input.w,
        input.h,
        input.rotationDeg,
        input.shape ?? "RECT",
        input.color ?? null,
        input.kind ?? "PERMANENT",
        input.isActive === false ? 0 : 1,
      ],
    );
    this.emit("layout.updated", { roomId: input.roomId });
    return toSeat(db.get(`SELECT * FROM "Seat" WHERE "id"=?`, [id]) ?? {});
  }

  async updateSeat(id: string, patch: SeatPatch) {
    const db = await this.ready;
    this.setColumns(db, "Seat", id, patch);
    const seat = toSeat(db.get(`SELECT * FROM "Seat" WHERE "id"=?`, [id]) ?? {});
    this.emit("seat.updated", seat);
    return seat;
  }

  async bulkUpdateSeats(roomId: string, seats: Array<{ id: string } & SeatPatch>) {
    const db = await this.ready;
    db.tx(() => {
      for (const { id, ...patch } of seats) this.setColumns(db, "Seat", id, patch);
    });
    this.emit("layout.updated", { roomId });
    return db.all(`SELECT * FROM "Seat" WHERE "roomId"=? ORDER BY "label"`, [roomId]).map(toSeat);
  }

  async deleteSeat(id: string) {
    const db = await this.ready;
    const seat = db.get(`SELECT * FROM "Seat" WHERE "id"=?`, [id]);
    const occupied = db.get(`SELECT 1 AS x FROM "Guest" WHERE "seatId"=? AND "status"='SEATED'`, [
      id,
    ]);
    if (occupied) throw new BillingError("seat is occupied", "SEAT_OCCUPIED");
    db.run(`DELETE FROM "Seat" WHERE "id"=?`, [id]);
    this.emit("layout.updated", { roomId: seat?.roomId, deleted: true });
  }

  // --- products ----------------------------------------------

  async listProducts(includeInactive = false) {
    const db = await this.ready;
    return db
      .all(
        `SELECT * FROM "Product" ${includeInactive ? "" : `WHERE "isActive"=1`} ORDER BY "sortOrder","name"`,
      )
      .map(toProduct);
  }

  async createProduct(input: ProductInput) {
    const db = await this.ready;
    const id = uuid();
    db.run(
      `INSERT INTO "Product" ("id","name","category","priceYen","isActive","sortOrder","color","emoji")
       VALUES (?,?,?,?,?,?,?,?)`,
      [
        id,
        input.name,
        input.category ?? null,
        input.priceYen,
        input.isActive === false ? 0 : 1,
        input.sortOrder ?? 0,
        input.color ?? null,
        input.emoji ?? null,
      ],
    );
    this.emit("product.updated", { id });
    return toProduct(db.get(`SELECT * FROM "Product" WHERE "id"=?`, [id]) ?? {});
  }

  async updateProduct(id: string, patch: Partial<ProductInput>) {
    const db = await this.ready;
    this.setColumns(db, "Product", id, patch);
    this.emit("product.updated", { id });
    return toProduct(db.get(`SELECT * FROM "Product" WHERE "id"=?`, [id]) ?? {});
  }

  async deleteProduct(id: string) {
    await this.updateProduct(id, { isActive: false });
  }

  // --- guests ----------------------------------------------

  async activeGuests() {
    const db = await this.ready;
    return db.all(`${GUEST_SELECT} WHERE g."status"='SEATED' ORDER BY g."arrivalAt"`).map(toGuest);
  }

  async assignableStaff() {
    const db = await this.ready;
    return db
      .all(
        `SELECT * FROM "User" WHERE "deletedAt" IS NULL AND "isActive"=1 AND "presence"<>'ABSENT'
         ORDER BY "displayName", "username"`,
      )
      .map(toUser);
  }

  async seatIn(input: SeatInInput): Promise<SeatInResult> {
    const db = await this.ready;
    const settings = await this.settings();
    const rateRow = db.get<{ r: number }>(
      `SELECT "defaultRatePerMinuteYen" AS r FROM "Settings" WHERE "id"='settings'`,
    );
    const cutover = db.get<{ h: number }>(
      `SELECT "serviceDayCutoverHour" AS h FROM "Settings" WHERE "id"='settings'`,
    );
    const rate = rateRow?.r ?? 10;
    const arrival = input.arrivalAt ?? nowIso();
    const serviceDay = serviceDayOf(new Date(arrival), cutover?.h ?? 5);

    const out = db.tx(() => {
      const seatIds = [...new Set(input.guests.map((g) => g.seatId))];
      const seats = db.all<{ id: string; isActive: number }>(
        `SELECT "id","isActive" FROM "Seat" WHERE "roomId"=? AND "id" IN (${seatIds.map(() => "?").join(",")})`,
        [input.roomId, ...seatIds],
      );
      if (seats.length !== seatIds.length) {
        throw new BillingError("one or more seats do not belong to this room", "BAD_SEAT");
      }
      if (seats.some((x) => !x.isActive)) {
        throw new BillingError("seat inactive", "SEAT_INACTIVE");
      }
      const occ = db.all(
        `SELECT DISTINCT "seatId" FROM "Guest" WHERE "status"='SEATED' AND "seatId" IN (${seatIds
          .map(() => "?")
          .join(",")})`,
        seatIds,
      );
      if (occ.length) throw new BillingError("seat already occupied", "SEAT_OCCUPIED");

      let partyId = input.partyId ?? null;
      if (!partyId) {
        partyId = uuid();
        db.run(`INSERT INTO "Party" ("id","label","arrivalAt","createdAt") VALUES (?,?,?,?)`, [
          partyId,
          input.partyLabel ?? null,
          arrival,
          nowIso(),
        ]);
      }

      const mkTicket = (): string => {
        const id = uuid();
        db.run(
          `INSERT INTO "Ticket" ("id","number","serviceDay","status","openedAt","createdAt","updatedAt")
           VALUES (?,?,?,'OPEN',?,?,?)`,
          [id, this.allocNumber(db, serviceDay), serviceDay, arrival, nowIso(), nowIso()],
        );
        return id;
      };

      const sharedId = input.separateTickets ? null : mkTicket();
      const ticketIds = new Set<string>();
      for (const g of input.guests) {
        const ticketId = sharedId ?? mkTicket();
        ticketIds.add(ticketId);
        db.run(
          `INSERT INTO "Guest" ("id","seatId","roomId","partyId","displayName","arrivalAt","ratePerMinuteYenSnapshot","setMinutesSnapshot","setPriceYenSnapshot","halfSetPriceYenSnapshot","ticketId","status","createdAt","updatedAt")
           VALUES (?,?,?,?,?,?,?,?,?,?,?,'SEATED',?,?)`,
          [
            uuid(),
            g.seatId,
            input.roomId,
            partyId,
            g.displayName ?? null,
            arrival,
            rate,
            settings.setMinutes,
            settings.setPriceYen,
            settings.halfSetPriceYen,
            ticketId,
            nowIso(),
            nowIso(),
          ],
        );
      }
      for (const id of ticketIds) this.recompute(db, id, settings);
      this.audit(db, "SEAT_IN", "party", partyId, { roomId: input.roomId });
      return { partyId, ticketIds: [...ticketIds] };
    });

    const tickets = out.ticketIds.map((id) => this.present(db, id, settings));
    this.emit("guest.seated", { roomId: input.roomId, tickets });
    for (const tk of tickets) this.emit("ticket.updated", tk);
    return { partyId: out.partyId, tickets };
  }

  /**
   * Move a guest to another seat; if that seat is taken, the two guests swap.
   * `arrivalAt`, `ticketId` and billing snapshots are untouched, so chronometers
   * and charges are unaffected.
   */
  async moveGuest(guestId: string, toSeatId: string) {
    const db = await this.ready;
    const ids = db.tx(() => {
      const guest = db.get<{ id: string; seatId: string; roomId: string; status: string }>(
        `SELECT "id","seatId","roomId","status" FROM "Guest" WHERE "id"=?`,
        [guestId],
      );
      if (!guest) throw new BillingError("guest not found", "NOT_FOUND");
      if (guest.status !== "SEATED")
        throw new BillingError("guest is no longer seated", "GUEST_CLOSED");

      const seat = db.get<{ id: string; roomId: string; isActive: number }>(
        `SELECT "id","roomId","isActive" FROM "Seat" WHERE "id"=?`,
        [toSeatId],
      );
      if (!seat) throw new BillingError("target seat not found", "NOT_FOUND");
      if (!seat.isActive) throw new BillingError("target seat is inactive", "SEAT_INACTIVE");

      const occupant = db.get<{ id: string }>(
        `SELECT "id" FROM "Guest" WHERE "seatId"=? AND "status"='SEATED' AND "id"<>?`,
        [toSeatId, guestId],
      );

      db.run(`UPDATE "Guest" SET "seatId"=?,"roomId"=?,"updatedAt"=? WHERE "id"=?`, [
        seat.id,
        seat.roomId,
        nowIso(),
        guestId,
      ]);
      if (occupant) {
        db.run(`UPDATE "Guest" SET "seatId"=?,"roomId"=?,"updatedAt"=? WHERE "id"=?`, [
          guest.seatId,
          guest.roomId,
          nowIso(),
          occupant.id,
        ]);
      }
      return occupant ? [guestId, occupant.id] : [guestId];
    });

    const rows = db.all(`${GUEST_SELECT} WHERE g."id" IN (${ids.map(() => "?").join(",")})`, ids);
    for (const r of rows) this.emit("seat.updated", toGuest(r));
    return toGuest(rows.find((r) => r.id === guestId) ?? {});
  }

  async seatOutGuest(guestId: string) {
    const db = await this.ready;
    const settings = await this.settings();
    const row = db.get(`SELECT * FROM "Guest" WHERE "id"=?`, [guestId]);
    if (!row) throw new BillingError("guest not found", "NOT_FOUND");
    const guest = toGuest(row);
    if (guest.status !== "SEATED") throw new BillingError("guest already closed", "GUEST_CLOSED");
    const at = nowIso();
    const charge = computeGuestCharge({ ...guest, closedAt: null }, settings, at);
    db.run(
      `UPDATE "Guest" SET "status"='CLOSED',"closedAt"=?,"billedMinutes"=?,"timeChargeYen"=?,"updatedAt"=? WHERE "id"=?`,
      [at, charge.billedMinutes, charge.timeChargeYen, at, guestId],
    );
    db.run(
      `UPDATE "GuestAssignment" SET "endedAt"=?,"endedReason"='GUEST_LEFT' WHERE "guestId"=? AND "endedAt" IS NULL`,
      [at, guestId],
    );
    if (guest.ticketId) this.recompute(db, guest.ticketId, settings);
    const updated = toGuest(db.get(`${GUEST_SELECT} WHERE g."id"=?`, [guestId]) ?? {});
    this.emit("guest.closed", updated);
    if (guest.ticketId) this.emit("ticket.updated", this.present(db, guest.ticketId, settings));
    return updated;
  }

  async renameGuest(guestId: string, displayName: string | null) {
    const db = await this.ready;
    const existing = db.get<{ id: string; ticketId: string | null }>(
      `SELECT "id","ticketId" FROM "Guest" WHERE "id"=?`,
      [guestId],
    );
    if (!existing) throw new BillingError("guest not found", "NOT_FOUND");
    db.run(`UPDATE "Guest" SET "displayName"=?,"updatedAt"=? WHERE "id"=?`, [
      displayName?.trim() || null,
      nowIso(),
      guestId,
    ]);
    const updated = toGuest(db.get(`${GUEST_SELECT} WHERE g."id"=?`, [guestId]) ?? {});
    this.emit("seat.updated", updated);
    if (existing.ticketId) {
      this.emit("ticket.updated", this.present(db, existing.ticketId, await this.settings()));
    }
    return updated;
  }

  async assignGuest(guestId: string, userId: string) {
    const db = await this.ready;
    const guest = db.get<{ status: string }>(`SELECT "status" FROM "Guest" WHERE "id"=?`, [guestId]);
    if (!guest) throw new BillingError("guest not found", "NOT_FOUND");
    if (guest.status !== "SEATED") throw new BillingError("guest not seated", "GUEST_CLOSED");
    const staff = db.get(
      `SELECT "id" FROM "User" WHERE "id"=? AND "deletedAt" IS NULL AND "isActive"=1`,
      [userId],
    );
    if (!staff) throw new BillingError("staff not found", "NOT_FOUND");
    const at = nowIso();
    db.run(
      `UPDATE "GuestAssignment" SET "endedAt"=?,"endedReason"='REASSIGNED' WHERE "guestId"=? AND "endedAt" IS NULL`,
      [at, guestId],
    );
    db.run(
      `INSERT INTO "GuestAssignment" ("id","guestId","userId","assignedByUserId","assignedAt") VALUES (?,?,?,?,?)`,
      [uuid(), guestId, userId, null, at],
    );
    const updated = toGuest(db.get(`${GUEST_SELECT} WHERE g."id"=?`, [guestId]) ?? {});
    this.emit("seat.updated", updated);
    this.emit("assignment.updated", updated);
    return updated;
  }

  async unassignGuest(guestId: string) {
    const db = await this.ready;
    const at = nowIso();
    db.run(
      `UPDATE "GuestAssignment" SET "endedAt"=?,"endedReason"='MANUAL' WHERE "guestId"=? AND "endedAt" IS NULL`,
      [at, guestId],
    );
    const updated = toGuest(db.get(`${GUEST_SELECT} WHERE g."id"=?`, [guestId]) ?? {});
    this.emit("seat.updated", updated);
    this.emit("assignment.updated", updated);
    return updated;
  }

  // --- tickets ---------------------------------------------

  async liveTickets() {
    const db = await this.ready;
    const settings = await this.settings();
    return db
      .all<{ id: string }>(`SELECT "id" FROM "Ticket" WHERE "status"='OPEN' ORDER BY "number"`)
      .map((r) => this.present(db, r.id, settings));
  }

  async listTickets(
    params: { status?: string; serviceDay?: string; from?: string; to?: string } = {},
  ) {
    const db = await this.ready;
    const settings = await this.settings();
    const where: string[] = [];
    const bind: unknown[] = [];
    if (params.status) {
      where.push(`"status"=?`);
      bind.push(params.status);
    }
    if (params.serviceDay) {
      where.push(`"serviceDay"=?`);
      bind.push(params.serviceDay);
    }
    if (params.from) {
      where.push(`"serviceDay">=?`);
      bind.push(params.from);
    }
    if (params.to) {
      where.push(`"serviceDay"<=?`);
      bind.push(params.to);
    }
    return db
      .all<{ id: string }>(
        `SELECT "id" FROM "Ticket" ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
         ORDER BY "serviceDay" DESC, "number" DESC LIMIT 2000`,
        bind,
      )
      .map((r) => this.present(db, r.id, settings));
  }

  async getTicket(id: string) {
    const db = await this.ready;
    if (!db.get(`SELECT 1 AS x FROM "Ticket" WHERE "id"=?`, [id])) {
      throw new BillingError("ticket not found", "NOT_FOUND");
    }
    return this.present(db, id, await this.settings());
  }

  async addItem(ticketId: string, body: Omit<AddItemInput, "ticketId">) {
    const db = await this.ready;
    const settings = await this.settings();
    db.tx(() => {
      const ticket = db.get<{ status: string }>(`SELECT "status" FROM "Ticket" WHERE "id"=?`, [
        ticketId,
      ]);
      if (!ticket) throw new BillingError("ticket not found", "NOT_FOUND");
      if (ticket.status !== "OPEN") throw new BillingError("ticket is not open", "TICKET_NOT_OPEN");

      let name = body.nameSnapshot ?? null;
      let price = body.unitPriceYen ?? null;
      if (body.productId) {
        const p = db.get<{ name: string; priceYen: number }>(
          `SELECT "name","priceYen" FROM "Product" WHERE "id"=?`,
          [body.productId],
        );
        if (!p) throw new BillingError("unknown product", "BAD_PRODUCT");
        name = name ?? p.name;
        price = price ?? p.priceYen;
      }
      if (name == null || price == null)
        throw new BillingError("missing item name or price", "BAD_ITEM");

      db.run(
        `INSERT INTO "TicketItem" ("id","ticketId","productId","nameSnapshot","unitPriceYen","quantity","guestId","addedAt","voided")
         VALUES (?,?,?,?,?,?,?,?,0)`,
        [
          uuid(),
          ticketId,
          body.productId ?? null,
          name,
          price,
          body.quantity ?? 1,
          body.guestId ?? null,
          nowIso(),
        ],
      );
      this.recompute(db, ticketId, settings);
      this.audit(db, "TICKET_ADD_ITEM", "ticket", ticketId, { productId: body.productId });
    });
    const view = this.present(db, ticketId, settings);
    this.emit("ticket.updated", view);
    return view;
  }

  async voidItem(ticketId: string, itemId: string) {
    const db = await this.ready;
    const settings = await this.settings();
    db.tx(() => {
      const item = db.get(`SELECT 1 AS x FROM "TicketItem" WHERE "id"=? AND "ticketId"=?`, [
        itemId,
        ticketId,
      ]);
      if (!item) throw new BillingError("item not found on ticket", "NOT_FOUND");
      db.run(`UPDATE "TicketItem" SET "voided"=1 WHERE "id"=?`, [itemId]);
      this.recompute(db, ticketId, settings);
      this.audit(db, "TICKET_VOID_ITEM", "ticket", ticketId, { itemId });
    });
    const view = this.present(db, ticketId, settings);
    this.emit("ticket.updated", view);
    return view;
  }

  async patchTicket(id: string, body: TicketPatchInput) {
    const db = await this.ready;
    const settings = await this.settings();
    db.tx(() => {
      if (!db.get(`SELECT 1 AS x FROM "Ticket" WHERE "id"=?`, [id])) {
        throw new BillingError("ticket not found", "NOT_FOUND");
      }
      this.setColumns(db, "Ticket", id, body);
      this.recompute(db, id, settings);
      this.audit(db, "TICKET_PATCH", "ticket", id, body);
    });
    const view = this.present(db, id, settings);
    this.emit("ticket.updated", view);
    return view;
  }

  async closeTicket(id: string, closedAt?: string) {
    const db = await this.ready;
    const settings = await this.settings();
    const at = closedAt ?? nowIso();
    db.tx(() => {
      const plan = planClose(this.bundle(db, id), settings, at);
      for (const g of plan.guests) {
        db.run(
          `UPDATE "Guest" SET "status"='CLOSED',"closedAt"=?,"billedMinutes"=?,"timeChargeYen"=?,"updatedAt"=? WHERE "id"=?`,
          [g.closedAt, g.billedMinutes, g.timeChargeYen, nowIso(), g.guestId],
        );
        db.run(
          `UPDATE "GuestAssignment" SET "endedAt"=?,"endedReason"='GUEST_LEFT' WHERE "guestId"=? AND "endedAt" IS NULL`,
          [at, g.guestId],
        );
      }
      db.run(
        `UPDATE "Ticket" SET "status"='CLOSED',"closedAt"=?,"timeYen"=?,"productsYen"=?,"totalYen"=?,"updatedAt"=? WHERE "id"=?`,
        [
          plan.closedAt,
          plan.totals.timeYen,
          plan.totals.productsYen,
          plan.totals.totalYen,
          nowIso(),
          id,
        ],
      );
      this.audit(db, "TICKET_CLOSE", "ticket", id, { totalYen: plan.totals.totalYen });
    });
    const view = this.present(db, id, settings);
    this.emit("guest.closed", view);
    this.emit("ticket.updated", view);
    return view;
  }

  async mergeTickets(input: MergeInput) {
    const db = await this.ready;
    const settings = await this.settings();
    db.tx(() => {
      const plan = planMerge(
        this.bundle(db, input.targetTicketId),
        input.sourceTicketIds.map((sid) => this.bundle(db, sid)),
        settings,
        new Date(),
      );
      if (plan.reassignGuestIds.length) {
        db.run(
          `UPDATE "Guest" SET "ticketId"=?,"updatedAt"=? WHERE "id" IN (${plan.reassignGuestIds
            .map(() => "?")
            .join(",")})`,
          [plan.targetTicketId, nowIso(), ...plan.reassignGuestIds],
        );
      }
      if (plan.reassignItemIds.length) {
        db.run(
          `UPDATE "TicketItem" SET "ticketId"=? WHERE "id" IN (${plan.reassignItemIds
            .map(() => "?")
            .join(",")})`,
          [plan.targetTicketId, ...plan.reassignItemIds],
        );
      }
      for (const vid of plan.voidTicketIds) {
        db.run(
          `UPDATE "Ticket" SET "status"='VOID',"mergedIntoTicketId"=?,"updatedAt"=? WHERE "id"=?`,
          [plan.targetTicketId, nowIso(), vid],
        );
      }
      this.recompute(db, plan.targetTicketId, settings);
      this.audit(db, "TICKET_MERGE", "ticket", plan.targetTicketId, {
        sources: input.sourceTicketIds,
      });
    });
    const view = this.present(db, input.targetTicketId, settings);
    this.emit("ticket.merged", { targetTicketId: input.targetTicketId, ticket: view });
    this.emit("ticket.updated", view);
    return view;
  }

  async splitTicket(
    id: string,
    body:
      | { mode: "ITEMIZED"; guestIds: string[]; itemIds: string[] }
      | { mode: "EVEN"; parts: number }
      | { mode: "GROUPS"; groups: string[][] },
  ): Promise<SplitResult> {
    const db = await this.ready;
    const settings = await this.settings();
    const origin = this.bundle(db, id);

    if (body.mode === "EVEN") {
      const plan = planEvenSplit(origin, { mode: "EVEN", parts: body.parts }, settings, new Date());
      this.audit(db, "TICKET_SPLIT", "ticket", id, { mode: "EVEN", shares: plan.shares });
      const ticket = this.present(db, id, settings);
      this.emit("ticket.split", { mode: "EVEN", plan, ticket });
      return { ...plan, ticket } as unknown as SplitResult;
    }

    if (body.mode === "GROUPS") {
      const serviceDay =
        db.get<{ serviceDay: string }>(`SELECT "serviceDay" FROM "Ticket" WHERE "id"=?`, [id])
          ?.serviceDay ?? "";
      const ticketIds = db.tx(() => {
        const newTicketIds: string[] = [];
        for (let i = 1; i < body.groups.length; i++) {
          const newId = uuid();
          db.run(
            `INSERT INTO "Ticket" ("id","number","serviceDay","status","openedAt","splitFromTicketId","createdAt","updatedAt")
             VALUES (?,?,?,'OPEN',?,?,?,?)`,
            [newId, this.allocNumber(db, serviceDay), serviceDay, nowIso(), id, nowIso(), nowIso()],
          );
          newTicketIds.push(newId);
        }
        const plan = planGroupedSplit(
          origin,
          { mode: "GROUPS", groups: body.groups, newTicketIds },
          settings,
          new Date(),
        );
        for (const group of plan.groups) {
          if (group.ticketId === id) continue;
          if (group.guestIds.length) {
            db.run(
              `UPDATE "Guest" SET "ticketId"=?,"updatedAt"=? WHERE "id" IN (${group.guestIds
                .map(() => "?")
                .join(",")})`,
              [group.ticketId, nowIso(), ...group.guestIds],
            );
          }
          if (group.itemIds.length) {
            db.run(
              `UPDATE "TicketItem" SET "ticketId"=? WHERE "id" IN (${group.itemIds
                .map(() => "?")
                .join(",")})`,
              [group.ticketId, ...group.itemIds],
            );
          }
        }
        for (const group of plan.groups) this.recompute(db, group.ticketId, settings);
        this.audit(db, "TICKET_SPLIT", "ticket", id, {
          mode: "GROUPS",
          ticketIds: plan.groups.map((g) => g.ticketId),
        });
        return plan.groups.map((g) => g.ticketId);
      });

      const tickets = ticketIds.map((tid) => this.present(db, tid, settings));
      for (const tk of tickets) this.emit("ticket.updated", tk);
      this.emit("ticket.split", { mode: "GROUPS", tickets });
      return { mode: "GROUPS", tickets };
    }

    const originRow = db.get<{ serviceDay: string }>(
      `SELECT "serviceDay" FROM "Ticket" WHERE "id"=?`,
      [id],
    );
    const newId = uuid();
    db.tx(() => {
      db.run(
        `INSERT INTO "Ticket" ("id","number","serviceDay","status","openedAt","splitFromTicketId","createdAt","updatedAt")
         VALUES (?,?,?,'OPEN',?,?,?,?)`,
        [
          newId,
          this.allocNumber(db, originRow?.serviceDay ?? ""),
          originRow?.serviceDay ?? "",
          nowIso(),
          id,
          nowIso(),
          nowIso(),
        ],
      );
      const plan = planItemizedSplit(
        origin,
        { mode: "ITEMIZED", newTicketId: newId, guestIds: body.guestIds, itemIds: body.itemIds },
        settings,
        new Date(),
      );
      if (plan.moveGuestIds.length) {
        db.run(
          `UPDATE "Guest" SET "ticketId"=?,"updatedAt"=? WHERE "id" IN (${plan.moveGuestIds
            .map(() => "?")
            .join(",")})`,
          [newId, nowIso(), ...plan.moveGuestIds],
        );
      }
      if (plan.moveItemIds.length) {
        db.run(
          `UPDATE "TicketItem" SET "ticketId"=? WHERE "id" IN (${plan.moveItemIds
            .map(() => "?")
            .join(",")})`,
          [newId, ...plan.moveItemIds],
        );
      }
      this.recompute(db, id, settings);
      this.recompute(db, newId, settings);
      this.audit(db, "TICKET_SPLIT", "ticket", id, { mode: "ITEMIZED", newTicketId: newId });
    });
    const originTicket = this.present(db, id, settings);
    const newTicket = this.present(db, newId, settings);
    this.emit("ticket.split", { mode: "ITEMIZED", originTicket, newTicket });
    this.emit("ticket.updated", originTicket);
    this.emit("ticket.updated", newTicket);
    return { mode: "ITEMIZED", originTicket, newTicket };
  }

  async listPayments(ticketId: string) {
    const db = await this.ready;
    return db
      .all(`SELECT * FROM "Payment" WHERE "ticketId"=? ORDER BY "paidAt"`, [ticketId])
      .map(toPayment);
  }

  async takePayment(
    ticketId: string,
    body: Omit<PaymentInput, "ticketId">,
  ): Promise<PaymentResult> {
    const db = await this.ready;
    const result = db.tx(() => {
      const ticket = db.get<{ status: string; totalYen: number; paidYen: number }>(
        `SELECT "status","totalYen","paidYen" FROM "Ticket" WHERE "id"=?`,
        [ticketId],
      );
      if (!ticket) throw new BillingError("ticket not found", "NOT_FOUND");
      if (ticket.status === "OPEN") throw new BillingError("close the ticket first", "TICKET_OPEN");
      if (ticket.status === "VOID") throw new BillingError("ticket is void", "TICKET_VOID");

      db.run(
        `INSERT INTO "Payment" ("id","ticketId","amountYen","method","paidAt","reference") VALUES (?,?,?,?,?,?)`,
        [uuid(), ticketId, body.amountYen, body.method, nowIso(), body.reference ?? null],
      );
      const paidYen = ticket.paidYen + body.amountYen;
      const fullyPaid = paidYen >= ticket.totalYen;
      db.run(`UPDATE "Ticket" SET "paidYen"=?,"status"=?,"paidAt"=?,"updatedAt"=? WHERE "id"=?`, [
        paidYen,
        fullyPaid ? "PAID" : ticket.status,
        fullyPaid ? nowIso() : null,
        nowIso(),
        ticketId,
      ]);
      this.audit(db, "PAYMENT", "ticket", ticketId, {
        amountYen: body.amountYen,
        method: body.method,
      });
      return { totalYen: ticket.totalYen, paidYen, status: fullyPaid ? "PAID" : ticket.status };
    });
    this.emit(result.status === "PAID" ? "ticket.paid" : "ticket.updated", { ticketId });
    return {
      ticketId,
      totalYen: result.totalYen,
      paidYen: result.paidYen,
      balanceYen: result.totalYen - result.paidYen,
      status: result.status,
    };
  }

  // --- users ---------------------------------------------

  async listUsers() {
    const db = await this.ready;
    return db
      .all(`SELECT * FROM "User" WHERE "deletedAt" IS NULL ORDER BY "createdAt"`)
      .map(toUser);
  }

  async createUser(input: UserCreateInput) {
    const db = await this.ready;
    const id = uuid();
    const hash = await sha256(input.password);
    db.run(
      `INSERT INTO "User" ("id","username","passwordHash","displayName","jobTitle","role","isActive","presence","createdAt","updatedAt")
       VALUES (?,?,?,?,?,?,1,'ABSENT',?,?)`,
      [
        id,
        input.username,
        hash,
        input.displayName ?? null,
        input.jobTitle ?? null,
        input.role,
        nowIso(),
        nowIso(),
      ],
    );
    return toUser(db.get(`SELECT * FROM "User" WHERE "id"=?`, [id]) ?? {});
  }

  async updateUser(id: string, patch: UserUpdateInput) {
    const db = await this.ready;
    const cols: Record<string, unknown> = {};
    if (patch.displayName !== undefined) cols.displayName = patch.displayName;
    if (patch.jobTitle !== undefined) cols.jobTitle = patch.jobTitle;
    if (patch.role !== undefined) cols.role = patch.role;
    if (patch.isActive !== undefined) cols.isActive = patch.isActive ? 1 : 0;
    if (Object.keys(cols).length) {
      cols.updatedAt = nowIso();
      this.setColumns(db, "User", id, cols);
    }
    return toUser(db.get(`SELECT * FROM "User" WHERE "id"=?`, [id]) ?? {});
  }

  async setUserActive(id: string, isActive: boolean) {
    return this.updateUser(id, { isActive });
  }

  async setUserPresence(id: string, presence: StaffPresence) {
    const db = await this.ready;
    db.run(`UPDATE "User" SET "presence"=?,"presenceChangedAt"=?,"updatedAt"=? WHERE "id"=?`, [
      presence,
      nowIso(),
      nowIso(),
      id,
    ]);
    return toUser(db.get(`SELECT * FROM "User" WHERE "id"=?`, [id]) ?? {});
  }

  async resetUserPassword(id: string, password: string) {
    const db = await this.ready;
    db.run(`UPDATE "User" SET "passwordHash"=?,"updatedAt"=? WHERE "id"=?`, [
      await sha256(password),
      nowIso(),
      id,
    ]);
    db.run(
      `UPDATE "RefreshToken" SET "revokedAt"=? WHERE "userId"=? AND "revokedAt" IS NULL`,
      [nowIso(), id],
    );
  }

  async deleteUser(id: string) {
    const db = await this.ready;
    const used =
      (db.get<{ n: number }>(
        `SELECT
           (SELECT COUNT(*) FROM "TicketItem" WHERE "addedByUserId"=?) +
           (SELECT COUNT(*) FROM "Payment" WHERE "receivedByUserId"=?) +
           (SELECT COUNT(*) FROM "AuditLog" WHERE "userId"=?) AS n`,
        [id, id, id],
      )?.n ?? 0) > 0;
    if (used) {
      db.run(`UPDATE "User" SET "deletedAt"=?,"isActive"=0,"updatedAt"=? WHERE "id"=?`, [
        nowIso(),
        nowIso(),
        id,
      ]);
    } else {
      db.run(`DELETE FROM "User" WHERE "id"=?`, [id]);
    }
  }

  // --- helpers ---------------------------------------------

  /** Write the given columns; booleans are coerced to 0/1. */
  private setColumns(db: LocalDb, table: string, id: string, patch: Record<string, unknown>): void {
    const cols = Object.keys(patch);
    if (!cols.length) return;
    db.run(`UPDATE "${table}" SET ${cols.map((c) => `"${c}"=?`).join(",")} WHERE "id"=?`, [
      ...cols.map((c) =>
        typeof patch[c] === "boolean" ? (patch[c] ? 1 : 0) : (patch[c] as unknown),
      ),
      id,
    ]);
  }
}
