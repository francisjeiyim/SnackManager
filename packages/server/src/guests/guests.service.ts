import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import {
  AuditAction,
  ServiceEvent,
  computeGuestCharge,
  type MoveGuestInput,
} from "@snackmanager/shared";
import { PrismaService } from "../prisma/prisma.service";
import { SettingsService } from "../settings/settings.service";
import { EventsGateway } from "../events/events.gateway";
import { AuditService } from "../audit/audit.service";
import { TicketsService } from "../tickets/tickets.service";
import { toBillingSettings, toGuest } from "../common/mappers";

const withSeat = { seat: { select: { label: true } } } as const;

@Injectable()
export class GuestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly events: EventsGateway,
    private readonly audit: AuditService,
    private readonly tickets: TicketsService,
  ) {}

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

      const charge = computeGuestCharge(
        { ...toGuest(guest), closedAt: null },
        settings,
        now.toISOString(),
      );
      return tx.guest.update({
        where: { id: guestId },
        data: {
          status: "CLOSED",
          closedAt: now,
          billedMinutes: charge.billedMinutes,
          timeChargeYen: charge.timeChargeYen,
        },
      });
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
}
