import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { ServiceEvent, type UserCreateInput } from "@snackmanager/shared";
import { PrismaService } from "../prisma/prisma.service";
import { EventsGateway } from "../events/events.gateway";
import { toPublicUser } from "../common/mappers";

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
  ) {}

  async list() {
    const users = await this.prisma.user.findMany({ orderBy: { createdAt: "asc" } });
    return users.map(toPublicUser);
  }

  async create(input: UserCreateInput) {
    const exists = await this.prisma.user.findUnique({ where: { username: input.username } });
    if (exists) throw new ConflictException("username already taken");
    const user = await this.prisma.user.create({
      data: {
        username: input.username,
        passwordHash: await bcrypt.hash(input.password, 10),
        displayName: input.displayName ?? null,
        role: input.role,
      },
    });
    const pub = toPublicUser(user);
    this.events.emitEvent(ServiceEvent.USER_UPDATED, pub);
    return pub;
  }

  async setActive(id: string, isActive: boolean) {
    try {
      const pub = toPublicUser(
        await this.prisma.user.update({ where: { id }, data: { isActive } }),
      );
      this.events.emitEvent(ServiceEvent.USER_UPDATED, pub);
      return pub;
    } catch {
      throw new NotFoundException("user not found");
    }
  }
}
