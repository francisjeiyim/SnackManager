import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  AuditAction,
  ServiceEvent,
  TicketStatus,
  computeTicketTotals,
  planClose,
  planEvenSplit,
  planGroupedSplit,
  planItemizedSplit,
  planMerge,
  type BillingSettings,
  type AddItemInput,
  type MergeInput,
  type SeatInInput,
  type SplitInputDto,
  type TicketPatchInput,
} from "@snackmanager/shared";
import { PrismaService } from "../prisma/prisma.service";
import { SettingsService } from "../settings/settings.service";
import { EventsGateway } from "../events/events.gateway";
import { AuditService } from "../audit/audit.service";
import { serviceDayOf } from "../common/service-day";
import {
  toBillingSettings,
  toBundle,
  toGuest,
  toPayment,
  toTicket,
  toTicketItem,
} from "../common/mappers";

type Tx = Prisma.TransactionClient;

const withGraph = {
  guests: {
    orderBy: { arrivalAt: "asc" },
    include: {
      seat: { select: { label: true } },
      assignments: {
        where: { endedAt: null },
        include: { user: { select: { id: true, displayName: true, username: true } } },
      },
    },
  },
  items: { orderBy: { addedAt: "asc" } },
  payments: { orderBy: { paidAt: "asc" } },
} satisfies Prisma.TicketInclude;

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly events: EventsGateway,
    private readonly audit: AuditService,
  ) {}

  // --- reads ------------------------------------------------------------

  async get(id: string) {
    const [ticket, settings] = await Promise.all([
      this.prisma.ticket.findUnique({ where: { id }, include: withGraph }),
      this.settings.billing(),
    ]);
    if (!ticket) throw new NotFoundException("ticket not found");
    return this.presentWith(ticket, settings);
  }

  async listLive() {
    const [tickets, settings] = await Promise.all([
      this.prisma.ticket.findMany({
        where: { status: TicketStatus.OPEN },
        include: withGraph,
        orderBy: { number: "asc" },
      }),
      this.settings.billing(),
    ]);
    return tickets.map((t) => this.presentWith(t, settings));
  }

  async list(params: { status?: string; serviceDay?: string; from?: string; to?: string }) {
    const range = params.from || params.to ? { gte: params.from, lte: params.to } : undefined;
    const [tickets, settings] = await Promise.all([
      this.prisma.ticket.findMany({
        where: {
          status: params.status ? (params.status as TicketStatus) : undefined,
          serviceDay: params.serviceDay ?? range,
        },
        include: withGraph,
        orderBy: [{ serviceDay: "desc" }, { number: "desc" }],
        take: 2000,
      }),
      this.settings.billing(),
    ]);
    return tickets.map((t) => this.presentWith(t, settings));
  }

  /** Ticket rows plus billing totals computed live against `now`. */
  private presentWith(
    ticket: Prisma.TicketGetPayload<{ include: typeof withGraph }>,
    settings: BillingSettings,
    now: Date = new Date(),
  ) {
    const live = computeTicketTotals(toBundle(ticket, ticket.guests, ticket.items), settings, now);
    return {
      ...toTicket(ticket),
      guests: ticket.guests.map(toGuest),
      items: ticket.items.map(toTicketItem),
      payments: ticket.payments.map(toPayment),
      live,
    };
  }

  // --- seat-in --------------------------------------------------------

  async seatIn(input: SeatInInput, userId?: string) {
    const now = input.arrivalAt ? new Date(input.arrivalAt) : new Date();
    const s = await this.settings.getRaw();
    const rate = s.defaultRatePerMinuteYen;
    const serviceDay = serviceDayOf(now, s.serviceDayCutoverHour);
    const setSnapshot = {
      setMinutesSnapshot: s.setMinutes,
      setPriceYenSnapshot: s.setPriceYen,
      halfSetPriceYenSnapshot: s.halfSetPriceYen,
    };

    const out = await this.prisma.$transaction(async (tx) => {
      const seatIds = input.guests.map((g) => g.seatId);
      const uniqueSeatIds = [...new Set(seatIds)];
      const seats = await tx.seat.findMany({
        where: { id: { in: uniqueSeatIds }, roomId: input.roomId },
      });
      if (seats.length !== uniqueSeatIds.length) {
        throw new BadRequestException("one or more seats do not belong to this room");
      }
      const inactive = seats.filter((seat) => !seat.isActive);
      if (inactive.length) {
        throw new ConflictException(`seat inactive: ${inactive.map((x) => x.label).join(", ")}`);
      }
      const occupied = await tx.guest.findMany({
        where: { seatId: { in: uniqueSeatIds }, status: "SEATED" },
      });
      if (occupied.length) {
        throw new ConflictException(
          `seat already occupied: ${[...new Set(occupied.map((o) => o.seatId))].join(", ")}`,
        );
      }

      let partyId = input.partyId ?? null;
      if (partyId) {
        const party = await tx.party.findUnique({ where: { id: partyId } });
        if (!party) throw new BadRequestException("unknown party");
      } else {
        const party = await tx.party.create({
          data: { label: input.partyLabel ?? null, arrivalAt: now },
        });
        partyId = party.id;
      }

      const allocNumber = async (): Promise<number> => {
        const c = await tx.ticketCounter.upsert({
          where: { serviceDay },
          create: { serviceDay, lastNumber: 1 },
          update: { lastNumber: { increment: 1 } },
        });
        return c.lastNumber;
      };

      const sharedTicketId = input.separateTickets
        ? null
        : (await tx.ticket.create({ data: { number: await allocNumber(), serviceDay } })).id;

      const ticketIds = new Set<string>();
      for (const g of input.guests) {
        const ticketId =
          sharedTicketId ??
          (await tx.ticket.create({ data: { number: await allocNumber(), serviceDay } })).id;
        ticketIds.add(ticketId);
        await tx.guest.create({
          data: {
            seatId: g.seatId,
            roomId: input.roomId,
            partyId,
            displayName: g.displayName ?? null,
            arrivalAt: now,
            ratePerMinuteYenSnapshot: rate,
            ...setSnapshot,
            ticketId,
            status: "SEATED",
          },
        });
      }

      for (const tid of ticketIds) await this.recompute(tx, tid, now);
      return { partyId, ticketIds: [...ticketIds] };
    });

    const tickets = await Promise.all(out.ticketIds.map((id) => this.get(id)));
    await this.audit.record({
      action: AuditAction.SEAT_IN,
      entityType: "party",
      entityId: out.partyId!,
      userId,
      data: { roomId: input.roomId, seatIds: input.guests.map((g) => g.seatId) },
    });
    this.events.emitEvent(
      ServiceEvent.GUEST_SEATED,
      { roomId: input.roomId, tickets },
      input.roomId,
    );
    for (const t of tickets) this.events.emitEvent(ServiceEvent.TICKET_UPDATED, t);
    return { partyId: out.partyId, tickets };
  }

  // --- line items ---------------------------------------------------

  async addItem(input: AddItemInput, userId?: string) {
    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findUnique({ where: { id: input.ticketId } });
      if (!ticket) throw new NotFoundException("ticket not found");
      if (ticket.status !== TicketStatus.OPEN) {
        throw new ConflictException("ticket is not open");
      }

      let name = input.nameSnapshot ?? null;
      let price = input.unitPriceYen ?? null;
      if (input.productId) {
        const product = await tx.product.findUnique({ where: { id: input.productId } });
        if (!product) throw new BadRequestException("unknown product");
        name = name ?? product.name;
        price = price ?? product.priceYen;
      }
      if (name == null || price == null) {
        throw new BadRequestException("missing item name or price");
      }
      if (input.guestId) {
        const g = await tx.guest.findFirst({
          where: { id: input.guestId, ticketId: input.ticketId },
        });
        if (!g) throw new BadRequestException("guest is not on this ticket");
      }

      await tx.ticketItem.create({
        data: {
          ticketId: input.ticketId,
          productId: input.productId ?? null,
          nameSnapshot: name,
          unitPriceYen: price,
          quantity: input.quantity,
          guestId: input.guestId ?? null,
          addedByUserId: userId ?? null,
        },
      });
      await this.recompute(tx, input.ticketId, now);
      return tx.ticket.findUniqueOrThrow({ where: { id: input.ticketId }, include: withGraph });
    });

    const presented = this.presentWith(updated, await this.settings.billing(), now);
    await this.audit.record({
      action: AuditAction.TICKET_ADD_ITEM,
      entityType: "ticket",
      entityId: input.ticketId,
      userId,
      data: { productId: input.productId, quantity: input.quantity },
    });
    this.events.emitEvent(ServiceEvent.TICKET_UPDATED, presented);
    return presented;
  }

  async voidItem(ticketId: string, itemId: string, userId?: string) {
    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const item = await tx.ticketItem.findFirst({ where: { id: itemId, ticketId } });
      if (!item) throw new NotFoundException("item not found on ticket");
      await tx.ticketItem.update({ where: { id: itemId }, data: { voided: true } });
      await this.recompute(tx, ticketId, now);
      return tx.ticket.findUniqueOrThrow({ where: { id: ticketId }, include: withGraph });
    });
    const presented = this.presentWith(updated, await this.settings.billing(), now);
    await this.audit.record({
      action: AuditAction.TICKET_VOID_ITEM,
      entityType: "ticket",
      entityId: ticketId,
      userId,
      data: { itemId },
    });
    this.events.emitEvent(ServiceEvent.TICKET_UPDATED, presented);
    return presented;
  }

  async patch(id: string, input: TicketPatchInput, userId?: string) {
    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findUnique({ where: { id } });
      if (!ticket) throw new NotFoundException("ticket not found");
      await tx.ticket.update({ where: { id }, data: input });
      await this.recompute(tx, id, now);
      return tx.ticket.findUniqueOrThrow({ where: { id }, include: withGraph });
    });
    const presented = this.presentWith(updated, await this.settings.billing(), now);
    await this.audit.record({
      action: AuditAction.TICKET_PATCH,
      entityType: "ticket",
      entityId: id,
      userId,
      data: input,
    });
    this.events.emitEvent(ServiceEvent.TICKET_UPDATED, presented);
    return presented;
  }

  // --- close ------------------------------------------------------

  async close(id: string, closedAtIso?: string, userId?: string, billConsumed = true) {
    const now = closedAtIso ? new Date(closedAtIso) : new Date();
    const settings = toBillingSettings(await this.settings.getRaw());

    await this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findUnique({ where: { id }, include: withGraph });
      if (!ticket) throw new NotFoundException("ticket not found");

      const plan = planClose(toBundle(ticket, ticket.guests, ticket.items), settings, now, {
        billConsumed,
      });

      for (const g of plan.guests) {
        await tx.guest.update({
          where: { id: g.guestId },
          data: {
            status: "CLOSED",
            closedAt: new Date(g.closedAt),
            billedMinutes: g.billedMinutes,
            timeChargeYen: g.timeChargeYen,
            validatedHalfSets: g.validatedHalfSets,
          },
        });
      }
      // Release any staff still assigned to these guests (kept as history).
      await tx.guestAssignment.updateMany({
        where: { guestId: { in: plan.guests.map((g) => g.guestId) }, endedAt: null },
        data: { endedAt: now, endedReason: "GUEST_LEFT" },
      });
      await tx.ticket.update({
        where: { id },
        data: {
          status: TicketStatus.CLOSED,
          closedAt: new Date(plan.closedAt),
          timeYen: plan.totals.timeYen,
          productsYen: plan.totals.productsYen,
          totalYen: plan.totals.totalYen,
        },
      });
    });

    const presented = await this.get(id);
    await this.audit.record({
      action: AuditAction.TICKET_CLOSE,
      entityType: "ticket",
      entityId: id,
      userId,
      data: { totalYen: presented.totalYen },
    });
    this.events.emitEvent(ServiceEvent.GUEST_CLOSED, presented);
    this.events.emitEvent(ServiceEvent.TICKET_UPDATED, presented);
    return presented;
  }

  // --- merge ----------------------------------------------------

  async merge(input: MergeInput, userId?: string) {
    const now = new Date();
    const settings = toBillingSettings(await this.settings.getRaw());

    await this.prisma.$transaction(async (tx) => {
      const load = (id: string) =>
        tx.ticket.findUnique({ where: { id }, include: withGraph }).then((t) => {
          if (!t) throw new NotFoundException(`ticket ${id} not found`);
          return t;
        });
      const target = await load(input.targetTicketId);
      const sources = await Promise.all(input.sourceTicketIds.map(load));

      const plan = planMerge(
        toBundle(target, target.guests, target.items),
        sources.map((sourceTicket) =>
          toBundle(sourceTicket, sourceTicket.guests, sourceTicket.items),
        ),
        settings,
        now,
      );

      await tx.guest.updateMany({
        where: { id: { in: plan.reassignGuestIds } },
        data: { ticketId: plan.targetTicketId },
      });
      await tx.ticketItem.updateMany({
        where: { id: { in: plan.reassignItemIds } },
        data: { ticketId: plan.targetTicketId },
      });
      await tx.ticket.updateMany({
        where: { id: { in: plan.voidTicketIds } },
        data: { status: TicketStatus.VOID, mergedIntoTicketId: plan.targetTicketId },
      });
      await this.recompute(tx, plan.targetTicketId, now);
    });

    const presented = await this.get(input.targetTicketId);
    await this.audit.record({
      action: AuditAction.TICKET_MERGE,
      entityType: "ticket",
      entityId: input.targetTicketId,
      userId,
      data: { sources: input.sourceTicketIds },
    });
    this.events.emitEvent(ServiceEvent.TICKET_MERGED, {
      targetTicketId: input.targetTicketId,
      sourceTicketIds: input.sourceTicketIds,
      ticket: presented,
    });
    this.events.emitEvent(ServiceEvent.TICKET_UPDATED, presented);
    return presented;
  }

  // --- split --------------------------------------------------

  async split(input: SplitInputDto, userId?: string) {
    const now = new Date();
    const s = await this.settings.getRaw();
    const settings = toBillingSettings(s);

    const origin = await this.prisma.ticket.findUnique({
      where: { id: input.ticketId },
      include: withGraph,
    });
    if (!origin) throw new NotFoundException("ticket not found");
    const originBundle = toBundle(origin, origin.guests, origin.items);

    if (input.mode === "EVEN") {
      const plan = planEvenSplit(originBundle, { mode: "EVEN", parts: input.parts }, settings, now);
      await this.audit.record({
        action: AuditAction.TICKET_SPLIT,
        entityType: "ticket",
        entityId: input.ticketId,
        userId,
        data: { mode: "EVEN", parts: input.parts, shares: plan.shares },
      });
      const ticket = await this.get(input.ticketId);
      this.events.emitEvent(ServiceEvent.TICKET_SPLIT, { mode: "EVEN", plan, ticket });
      return { ...plan, ticket };
    }

    if (input.mode === "GROUPS") {
      const serviceDay = origin.serviceDay;
      const ticketIds = await this.prisma.$transaction(async (tx) => {
        const newTicketIds: string[] = [];
        for (let i = 1; i < input.groups.length; i++) {
          const c = await tx.ticketCounter.upsert({
            where: { serviceDay },
            create: { serviceDay, lastNumber: 1 },
            update: { lastNumber: { increment: 1 } },
          });
          const t = await tx.ticket.create({
            data: { number: c.lastNumber, serviceDay, splitFromTicketId: origin.id },
          });
          newTicketIds.push(t.id);
        }

        const plan = planGroupedSplit(
          originBundle,
          { mode: "GROUPS", groups: input.groups, newTicketIds },
          settings,
          now,
        );

        for (const group of plan.groups) {
          if (group.ticketId === origin.id) continue;
          await tx.guest.updateMany({
            where: { id: { in: group.guestIds } },
            data: { ticketId: group.ticketId },
          });
          if (group.itemIds.length) {
            await tx.ticketItem.updateMany({
              where: { id: { in: group.itemIds } },
              data: { ticketId: group.ticketId },
            });
          }
        }
        for (const group of plan.groups) await this.recompute(tx, group.ticketId, now);
        return plan.groups.map((g) => g.ticketId);
      });

      const tickets = await Promise.all(ticketIds.map((tid) => this.get(tid)));
      await this.audit.record({
        action: AuditAction.TICKET_SPLIT,
        entityType: "ticket",
        entityId: origin.id,
        userId,
        data: { mode: "GROUPS", ticketIds },
      });
      for (const tk of tickets) this.events.emitEvent(ServiceEvent.TICKET_UPDATED, tk);
      this.events.emitEvent(ServiceEvent.TICKET_SPLIT, { mode: "GROUPS", tickets });
      return { mode: "GROUPS" as const, tickets };
    }

    const serviceDay = origin.serviceDay;
    const result = await this.prisma.$transaction(async (tx) => {
      const c = await tx.ticketCounter.upsert({
        where: { serviceDay },
        create: { serviceDay, lastNumber: 1 },
        update: { lastNumber: { increment: 1 } },
      });
      const newTicket = await tx.ticket.create({
        data: {
          number: c.lastNumber,
          serviceDay,
          splitFromTicketId: origin.id,
        },
      });

      const plan = planItemizedSplit(
        originBundle,
        {
          mode: "ITEMIZED",
          newTicketId: newTicket.id,
          guestIds: input.guestIds,
          itemIds: input.itemIds,
        },
        settings,
        now,
      );

      await tx.guest.updateMany({
        where: { id: { in: plan.moveGuestIds } },
        data: { ticketId: newTicket.id },
      });
      await tx.ticketItem.updateMany({
        where: { id: { in: plan.moveItemIds } },
        data: { ticketId: newTicket.id },
      });
      await this.recompute(tx, origin.id, now);
      await this.recompute(tx, newTicket.id, now);
      return { newTicketId: newTicket.id };
    });

    const [originPresented, newPresented] = await Promise.all([
      this.get(origin.id),
      this.get(result.newTicketId),
    ]);
    await this.audit.record({
      action: AuditAction.TICKET_SPLIT,
      entityType: "ticket",
      entityId: origin.id,
      userId,
      data: { mode: "ITEMIZED", newTicketId: result.newTicketId },
    });
    this.events.emitEvent(ServiceEvent.TICKET_SPLIT, {
      mode: "ITEMIZED",
      originTicket: originPresented,
      newTicket: newPresented,
    });
    this.events.emitEvent(ServiceEvent.TICKET_UPDATED, originPresented);
    this.events.emitEvent(ServiceEvent.TICKET_UPDATED, newPresented);
    return { mode: "ITEMIZED" as const, originTicket: originPresented, newTicket: newPresented };
  }

  // --- helpers -------------------------------------------------

  /** Recompute + persist a ticket's stored totals (own transaction). */
  async refreshTotals(ticketId: string): Promise<void> {
    await this.prisma.$transaction((tx) => this.recompute(tx, ticketId, new Date()));
  }

  /** Recompute + persist a ticket's stored snapshot totals inside a tx. */
  private async recompute(tx: Tx, ticketId: string, now: Date): Promise<void> {
    const settings = await this.settings.billing();
    const ticket = await tx.ticket.findUniqueOrThrow({ where: { id: ticketId } });
    const guests = await tx.guest.findMany({ where: { ticketId } });
    const items = await tx.ticketItem.findMany({ where: { ticketId } });
    const totals = computeTicketTotals(toBundle(ticket, guests, items), settings, now);
    await tx.ticket.update({
      where: { id: ticketId },
      data: {
        timeYen: totals.timeYen,
        productsYen: totals.productsYen,
        totalYen: totals.totalYen,
      },
    });
  }
}
