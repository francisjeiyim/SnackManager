import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import {
  AuditAction,
  ExtensionKind,
  ServiceEvent,
  computeGuestCharge,
  type MoveGuestInput,
} from "@snackmanager/shared";
import { PrismaService } from "../prisma/prisma.service";
import { SettingsService } from "../settings/settings.service";
import { EventsGateway } from "../events/events.gateway";
import { AuditService } from "../audit/audit.service";
import { TicketsService } from "../tickets/tickets.service";
import { toBillingSettings, toGuest, toPublicUser } from "../common/mappers";

/** Everything the board / ticket panel needs about a guest in one query. */
const withSeat = {
  seat: { select: { label: true } },
  assignments: {
    where: { endedAt: null },
    include: {
      user: { select: { id: true, displayName: true, username: true } },
    },
  },
  extensions: { orderBy: { validatedAt: "asc" } },
} as const;

@Injectable()
export class GuestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly events: EventsGateway,
    private readonly audit: AuditService,
    private readonly tickets: TicketsService,
  ) {}

  /** Present, active staff — the pick list for assigning a guest to someone. */
  async assignableStaff() {
    const staff = await this.prisma.user.findMany({
      where: { deletedAt: null, isActive: true, presence: { not: "ABSENT" } },
      orderBy: [{ displayName: "asc" }, { username: "asc" }],
    });
    return staff.map(toPublicUser);
  }

  /** Every currently seated guest — the raw material for the live board. */
  async active() {
    const guests = await this.prisma.guest.findMany({
      where: { status: "SEATED" },
      orderBy: { arrivalAt: "asc" },
      include: withSeat,
    });
    return guests.map(toGuest);
  }

  /**
   * Move a guest to another seat. If that seat is held by another seated guest,
   * the two swap places. Neither `arrivalAt`, `ticketId` nor any billing
   * snapshot is touched, so chronometers and charges are unaffected.
   */
  async move(input: MoveGuestInput, userId?: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const guest = await tx.guest.findUnique({ where: { id: input.guestId } });
      if (!guest) throw new NotFoundException("guest not found");
      if (guest.status !== "SEATED") throw new ConflictException("guest is no longer seated");

      const seat = await tx.seat.findUnique({ where: { id: input.toSeatId } });
      if (!seat) throw new NotFoundException("target seat not found");
      if (!seat.isActive) throw new ConflictException("target seat is inactive");

      const occupant = await tx.guest.findFirst({
        where: { seatId: input.toSeatId, status: "SEATED", NOT: { id: input.guestId } },
      });

      const fromSeatId = guest.seatId;
      const fromRoomId = guest.roomId;
      await tx.guest.update({
        where: { id: guest.id },
        data: { seatId: seat.id, roomId: seat.roomId },
      });
      if (occupant) {
        await tx.guest.update({
          where: { id: occupant.id },
          data: { seatId: fromSeatId, roomId: fromRoomId },
        });
      }
      const ids = occupant ? [guest.id, occupant.id] : [guest.id];
      const updated = await tx.guest.findMany({ where: { id: { in: ids } }, include: withSeat });
      return { updated, swapped: !!occupant };
    });

    await this.audit.record({
      action: AuditAction.SEAT_IN,
      entityType: "guest",
      entityId: input.guestId,
      userId,
      data: { movedTo: input.toSeatId, swapped: result.swapped },
    });
    for (const g of result.updated) {
      this.events.emitEvent(ServiceEvent.SEAT_UPDATED, toGuest(g), g.roomId);
    }
    return toGuest(result.updated.find((g) => g.id === input.guestId)!);
  }

  /** Close a single guest early (they leave before the rest of their party). */
  async seatOut(guestId: string, userId?: string) {
    const now = new Date();
    const settings = toBillingSettings(await this.settings.getRaw());

    const updated = await this.prisma.$transaction(async (tx) => {
      const guest = await tx.guest.findUnique({ where: { id: guestId } });
      if (!guest) throw new NotFoundException("guest not found");
      if (guest.status !== "SEATED") throw new ConflictException("guest is already closed");

      const withExt = await tx.guest.findUnique({ where: { id: guestId }, include: withSeat });
      // seat-out finalises this guest → bill the first set + every validated block
      const charge = computeGuestCharge(
        { ...toGuest(withExt!), closedAt: null },
        settings,
        now.toISOString(),
      );
      const g = await tx.guest.update({
        where: { id: guestId },
        data: {
          status: "CLOSED",
          closedAt: now,
          billedMinutes: charge.billedMinutes,
          timeChargeYen: charge.timeChargeYen,
        },
      });
      await tx.guestAssignment.updateMany({
        where: { guestId, endedAt: null },
        data: { endedAt: now, endedReason: "GUEST_LEFT" },
      });
      return g;
    });

    if (updated.ticketId) await this.tickets.refreshTotals(updated.ticketId);

    await this.audit.record({
      action: AuditAction.SEAT_OUT,
      entityType: "guest",
      entityId: guestId,
      userId,
      data: { timeChargeYen: updated.timeChargeYen },
    });
    this.events.emitEvent(ServiceEvent.GUEST_CLOSED, toGuest(updated), updated.roomId);
    if (updated.ticketId) {
      this.events.emitEvent(ServiceEvent.TICKET_UPDATED, await this.tickets.get(updated.ticketId));
    }
    return toGuest(updated);
  }

  /** Set (or clear) a guest's display name at any point. */
  async rename(guestId: string, displayName: string | null, userId?: string) {
    const guest = await this.prisma.guest
      .update({
        where: { id: guestId },
        data: { displayName: displayName?.trim() || null },
        include: withSeat,
      })
      .catch(() => {
        throw new NotFoundException("guest not found");
      });

    await this.audit.record({
      action: AuditAction.SEAT_IN,
      entityType: "guest",
      entityId: guestId,
      userId,
      data: { displayName: guest.displayName },
    });
    this.events.emitEvent(ServiceEvent.SEAT_UPDATED, toGuest(guest), guest.roomId);
    if (guest.ticketId) {
      this.events.emitEvent(ServiceEvent.TICKET_UPDATED, await this.tickets.get(guest.ticketId));
    }
    return toGuest(guest);
  }

  /**
   * Put a staff member in charge of a guest. Any staff currently assigned to
   * this guest is released (kept as history, `endedReason: REASSIGNED`).
   */
  async assign(guestId: string, staffUserId: string, byUserId?: string) {
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const guest = await tx.guest.findUnique({ where: { id: guestId } });
      if (!guest) throw new NotFoundException("guest not found");
      if (guest.status !== "SEATED") throw new ConflictException("guest is no longer seated");

      const staff = await tx.user.findFirst({
        where: { id: staffUserId, deletedAt: null, isActive: true },
      });
      if (!staff) throw new NotFoundException("staff member not found or inactive");

      await tx.guestAssignment.updateMany({
        where: { guestId, endedAt: null },
        data: { endedAt: now, endedReason: "REASSIGNED" },
      });
      await tx.guestAssignment.create({
        data: { guestId, userId: staffUserId, assignedByUserId: byUserId ?? null, assignedAt: now },
      });
    });

    await this.audit.record({
      action: AuditAction.STAFF_ASSIGN,
      entityType: "guest",
      entityId: guestId,
      userId: byUserId,
      data: { staffUserId },
    });
    return this.emitGuest(guestId);
  }

  /** Release the staff member currently assigned to a guest. */
  async unassign(guestId: string, byUserId?: string) {
    const ended = await this.prisma.guestAssignment.updateMany({
      where: { guestId, endedAt: null },
      data: { endedAt: new Date(), endedReason: "MANUAL" },
    });
    if (ended.count === 0) throw new NotFoundException("no active assignment");
    await this.audit.record({
      action: AuditAction.STAFF_UNASSIGN,
      entityType: "guest",
      entityId: guestId,
      userId: byUserId,
    });
    return this.emitGuest(guestId);
  }

  /**
   * Validate one time extension for a guest — a full set or a half-set. The
   * block's minutes and price are frozen from the guest's seat-in snapshot (or
   * the current Settings if the guest predates snapshots), and the block is
   * kept as history. Nothing is billed for elapsed time until a block exists.
   */
  async extendGuest(guestId: string, kind: ExtensionKind, userId?: string) {
    const settings = toBillingSettings(await this.settings.getRaw());
    const guest = await this.prisma.guest.findUnique({ where: { id: guestId } });
    if (!guest) throw new NotFoundException("guest not found");
    if (guest.status !== "SEATED") throw new ConflictException("guest is no longer seated");

    const setMinutes = guest.setMinutesSnapshot || settings.setMinutes;
    const minutes =
      kind === ExtensionKind.SET ? setMinutes : Math.round(setMinutes / 2);
    const priceYen =
      kind === ExtensionKind.SET
        ? guest.setPriceYenSnapshot || settings.setPriceYen
        : guest.halfSetPriceYenSnapshot || settings.halfSetPriceYen;

    await this.prisma.guestExtension.create({
      data: { guestId, kind, minutes, priceYen, validatedByUserId: userId ?? null },
    });
    await this.audit.record({
      action: AuditAction.EXTENSION_ADD,
      entityType: "guest",
      entityId: guestId,
      userId,
      data: { kind, minutes, priceYen },
    });
    if (guest.ticketId) {
      await this.tickets.refreshTotals(guest.ticketId);
      this.events.emitEvent(ServiceEvent.TICKET_UPDATED, await this.tickets.get(guest.ticketId));
    }
    return this.emitGuest(guestId);
  }

  /** Undo the guest's most recent validated extension (operator mis-click). */
  async undoLastExtension(guestId: string, userId?: string) {
    const guest = await this.prisma.guest.findUnique({ where: { id: guestId } });
    if (!guest) throw new NotFoundException("guest not found");
    if (guest.status !== "SEATED") throw new ConflictException("guest is no longer seated");

    const last = await this.prisma.guestExtension.findFirst({
      where: { guestId },
      orderBy: { validatedAt: "desc" },
    });
    if (!last) throw new NotFoundException("no extension to undo");

    await this.prisma.guestExtension.delete({ where: { id: last.id } });
    await this.audit.record({
      action: AuditAction.EXTENSION_UNDO,
      entityType: "guest",
      entityId: guestId,
      userId,
      data: { kind: last.kind, minutes: last.minutes, priceYen: last.priceYen },
    });
    if (guest.ticketId) {
      await this.tickets.refreshTotals(guest.ticketId);
      this.events.emitEvent(ServiceEvent.TICKET_UPDATED, await this.tickets.get(guest.ticketId));
    }
    return this.emitGuest(guestId);
  }

  /** Re-read a guest with its full graph and broadcast the change. */
  private async emitGuest(guestId: string) {
    const guest = await this.prisma.guest.findUnique({ where: { id: guestId }, include: withSeat });
    if (!guest) throw new NotFoundException("guest not found");
    const dto = toGuest(guest);
    this.events.emitEvent(ServiceEvent.SEAT_UPDATED, dto, guest.roomId);
    this.events.emitEvent(ServiceEvent.ASSIGNMENT_UPDATED, dto, guest.roomId);
    return dto;
  }
}
