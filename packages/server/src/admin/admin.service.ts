import { ForbiddenException, Injectable } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { AuditAction, ServiceEvent } from "@snackmanager/shared";
import { PrismaService } from "../prisma/prisma.service";
import { EventsGateway } from "../events/events.gateway";
import { AuditService } from "../audit/audit.service";

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
    private readonly audit: AuditService,
  ) {}

  /**
   * Wipe every bit of operational data — tickets, guests, payments, parties,
   * the audit log and the ticket counters — while keeping the setup (rooms,
   * seats, products, settings, user accounts). Gated by the caller's own admin
   * password, re-checked here.
   */
  async resetOperationalData(userId: string | undefined, password: string) {
    const user = userId
      ? await this.prisma.user.findUnique({ where: { id: userId } })
      : null;
    if (!user || user.role !== "ADMIN" || user.deletedAt) {
      throw new ForbiddenException("admin only");
    }
    // 403 (not 401) so a wrong password never trips the client's token-refresh
    // path and logs the admin out.
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new ForbiddenException("wrong password");

    const cleared = await this.prisma.$transaction(async (tx) => {
      const payments = (await tx.payment.deleteMany()).count;
      const items = (await tx.ticketItem.deleteMany()).count;
      await tx.guestExtension.deleteMany();
      await tx.guestAssignment.deleteMany();
      const guests = (await tx.guest.deleteMany()).count;
      const tickets = (await tx.ticket.deleteMany()).count;
      await tx.ticketCounter.deleteMany();
      const parties = (await tx.party.deleteMany()).count;
      const audits = (await tx.auditLog.deleteMany()).count;
      // drop any temporary floor arrangement, back to the saved layout
      await tx.seat.updateMany({ data: { tempX: null, tempY: null } });
      return { payments, items, guests, tickets, parties, audits };
    });

    await this.audit.record({
      action: AuditAction.DATA_RESET,
      entityType: "system",
      entityId: "database",
      userId,
      data: cleared,
    });
    // nudge every connected client to refetch everything
    this.events.emitEvent(ServiceEvent.SETTINGS_UPDATED, { reset: true });
    this.events.emitEvent(ServiceEvent.LAYOUT_UPDATED, { reset: true });

    return { ok: true, cleared };
  }
}
