import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, ServiceEvent, TicketStatus, type PaymentInput } from "@snackmanager/shared";
import { PrismaService } from "../prisma/prisma.service";
import { EventsGateway } from "../events/events.gateway";
import { AuditService } from "../audit/audit.service";
import { toPayment } from "../common/mappers";

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
    private readonly audit: AuditService,
  ) {}

  async take(input: PaymentInput, userId?: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findUnique({ where: { id: input.ticketId } });
      if (!ticket) throw new NotFoundException("ticket not found");
      if (ticket.status === TicketStatus.OPEN) {
        throw new ConflictException("close the ticket before taking payment");
      }
      if (ticket.status === TicketStatus.VOID) {
        throw new ConflictException("ticket is void");
      }

      const payment = await tx.payment.create({
        data: {
          ticketId: input.ticketId,
          amountYen: input.amountYen,
          method: input.method,
          reference: input.reference ?? null,
          receivedByUserId: userId ?? null,
        },
      });

      const paidYen = ticket.paidYen + input.amountYen;
      const fullyPaid = paidYen >= ticket.totalYen;
      const updated = await tx.ticket.update({
        where: { id: input.ticketId },
        data: {
          paidYen,
          status: fullyPaid ? TicketStatus.PAID : ticket.status,
          paidAt: fullyPaid ? new Date() : ticket.paidAt,
        },
      });
      return { payment, ticket: updated, fullyPaid };
    });

    await this.audit.record({
      action: AuditAction.PAYMENT,
      entityType: "ticket",
      entityId: input.ticketId,
      userId,
      data: { amountYen: input.amountYen, method: input.method },
    });
    const event = result.fullyPaid ? ServiceEvent.TICKET_PAID : ServiceEvent.TICKET_UPDATED;
    this.events.emitEvent(event, { ticketId: input.ticketId, payment: toPayment(result.payment) });

    return {
      payment: toPayment(result.payment),
      ticketId: input.ticketId,
      totalYen: result.ticket.totalYen,
      paidYen: result.ticket.paidYen,
      balanceYen: result.ticket.totalYen - result.ticket.paidYen,
      status: result.ticket.status,
    };
  }

  async listForTicket(ticketId: string) {
    const rows = await this.prisma.payment.findMany({
      where: { ticketId },
      orderBy: { paidAt: "asc" },
    });
    return rows.map(toPayment);
  }
}
