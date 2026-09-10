import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ServiceEvent, type SeatInput, type SeatPatch } from "@snackmanager/shared";
import { PrismaService } from "../prisma/prisma.service";
import { EventsGateway } from "../events/events.gateway";
import { toSeat } from "../common/mappers";

@Injectable()
export class SeatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
  ) {}

  async create(input: SeatInput) {
    const seat = await this.prisma.seat.create({ data: input });
    this.events.emitEvent(ServiceEvent.LAYOUT_UPDATED, toSeat(seat), seat.roomId);
    return toSeat(seat);
  }

  async update(id: string, patch: SeatPatch) {
    const seat = await this.prisma.seat.update({ where: { id }, data: patch }).catch(() => {
      throw new NotFoundException("seat not found");
    });
    this.events.emitEvent(ServiceEvent.SEAT_UPDATED, toSeat(seat), seat.roomId);
    return toSeat(seat);
  }

  /** Batch geometry update — one call per drag/resize gesture in the editor. */
  async bulkUpdate(roomId: string, seats: Array<{ id: string } & SeatPatch>) {
    const updated = await this.prisma.$transaction(
      seats.map((s) =>
        this.prisma.seat.update({ where: { id: s.id }, data: { ...s, id: undefined } }),
      ),
    );
    this.events.emitEvent(
      ServiceEvent.LAYOUT_UPDATED,
      { roomId, seats: updated.map(toSeat) },
      roomId,
    );
    return updated.map(toSeat);
  }

  /** Temporary, service-time floor positions — does not touch the saved x/y. */
  async arrange(roomId: string, seats: Array<{ id: string; x: number; y: number }>) {
    const updated = await this.prisma.$transaction(
      seats.map((s) =>
        this.prisma.seat.update({ where: { id: s.id }, data: { tempX: s.x, tempY: s.y } }),
      ),
    );
    this.events.emitEvent(
      ServiceEvent.LAYOUT_UPDATED,
      { roomId, seats: updated.map(toSeat) },
      roomId,
    );
    return updated.map(toSeat);
  }

  /** Drop the temporary positions for a room — back to the saved layout. */
  async resetArrangement(roomId: string) {
    await this.prisma.seat.updateMany({ where: { roomId }, data: { tempX: null, tempY: null } });
    const seats = await this.prisma.seat.findMany({ where: { roomId } });
    this.events.emitEvent(
      ServiceEvent.LAYOUT_UPDATED,
      { roomId, seats: seats.map(toSeat) },
      roomId,
    );
    return seats.map(toSeat);
  }

  async remove(id: string) {
    const seat = await this.prisma.seat.findUnique({ where: { id }, include: { guests: true } });
    if (!seat) throw new NotFoundException("seat not found");
    if (seat.guests.some((g) => g.status === "SEATED")) {
      throw new ConflictException("seat is occupied");
    }
    await this.prisma.seat.delete({ where: { id } });
    this.events.emitEvent(
      ServiceEvent.LAYOUT_UPDATED,
      { id, roomId: seat.roomId, deleted: true },
      seat.roomId,
    );
    return { ok: true };
  }
}
