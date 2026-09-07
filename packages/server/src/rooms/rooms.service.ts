import { Injectable, NotFoundException } from "@nestjs/common";
import { ServiceEvent, type RoomInput } from "@snackmanager/shared";
import { PrismaService } from "../prisma/prisma.service";
import { EventsGateway } from "../events/events.gateway";
import { toRoom, toSeat } from "../common/mappers";

@Injectable()
export class RoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
  ) {}

  async list() {
    const rooms = await this.prisma.room.findMany({
      orderBy: { sortOrder: "asc" },
      include: { seats: true },
    });
    return rooms.map((r) => ({
      ...toRoom(r),
      seats: r.seats.map(toSeat),
    }));
  }

  async get(id: string) {
    const room = await this.prisma.room.findUnique({ where: { id }, include: { seats: true } });
    if (!room) throw new NotFoundException("room not found");
    return { ...toRoom(room), seats: room.seats.map(toSeat) };
  }

  async create(input: RoomInput) {
    const room = await this.prisma.room.create({ data: input });
    this.events.emitEvent(ServiceEvent.ROOM_UPDATED, toRoom(room));
    return toRoom(room);
  }

  async update(id: string, input: Partial<RoomInput>) {
    try {
      const room = await this.prisma.room.update({ where: { id }, data: input });
      this.events.emitEvent(ServiceEvent.ROOM_UPDATED, toRoom(room), id);
      return toRoom(room);
    } catch {
      throw new NotFoundException("room not found");
    }
  }

  async remove(id: string) {
    try {
      await this.prisma.room.delete({ where: { id } });
      this.events.emitEvent(ServiceEvent.ROOM_UPDATED, { id, deleted: true });
      return { ok: true };
    } catch {
      throw new NotFoundException("room not found");
    }
  }
}
