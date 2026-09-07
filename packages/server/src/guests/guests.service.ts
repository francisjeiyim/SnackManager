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
import { toBillingSettings, toGuest } from "../common/mappers";

@Injectable()
export class GuestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly events: EventsGateway,
    private readonly audit: AuditService,
  ) {}

  /** Every currently seated guest — the raw material for the live board. */
  async active() {
    const guests = await this.prisma.guest.findMany({
      where: { status: "SEATED" },
      orderBy: { arrivalAt: "asc" },
    });
    return guests.map(toGuest);
  }

  async move(input: MoveGuestInput, userId?: string) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const guest = await tx.guest.findUnique({ where: { id: input.guestId } });
      if (!guest) throw new NotFoundException("guest not found");
      if (guest.status !== "SEATED") throw new ConflictException("guest is no longer seated");

      const seat = await tx.seat.findUnique({ where: { id: input.toSeatId } });
      if (!seat) throw new NotFoundException("target seat not found");
      if (!seat.isActive) throw new ConflictException("target seat is inactive");

      const taken = await tx.guest.findFirst({
        where: { seatId: input.toSeatId, status: "SEATED", NOT: { id: input.guestId } },
      });
      if (taken) throw new ConflictException("target seat is occupied");

      return tx.guest.update({
        where: { id: input.guestId },
        data: { seatId: seat.id, roomId: seat.roomId },
      });
    });

    await this.audit.record({
      action: AuditAction.SEAT_IN,
      entityType: "guest",
      entityId: input.guestId,
      userId,
      data: { movedTo: input.toSeatId },
    });
    this.events.emitEvent(ServiceEvent.SEAT_UPDATED, toGuest(updated), updated.roomId);
    return toGuest(updated);
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

    await this.audit.record({
      action: AuditAction.SEAT_OUT,
      entityType: "guest",
      entityId: guestId,
      userId,
      data: { timeChargeYen: updated.timeChargeYen },
    });
    this.events.emitEvent(ServiceEvent.GUEST_CLOSED, toGuest(updated), updated.roomId);
    if (updated.ticketId) {
      this.events.emitEvent(ServiceEvent.TICKET_UPDATED, { id: updated.ticketId });
    }
    return toGuest(updated);
  }
}
