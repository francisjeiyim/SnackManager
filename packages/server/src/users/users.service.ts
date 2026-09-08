import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import * as bcrypt from "bcrypt";
import {
  ServiceEvent,
  StaffPresence,
  type PasswordResetInput,
  type PresenceInput,
  type UserCreateInput,
  type UserUpdateInput,
} from "@snackmanager/shared";
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
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "asc" },
    });
    return users.map(toPublicUser);
  }

  async create(input: UserCreateInput) {
    const exists = await this.prisma.user.findFirst({ where: { username: input.username } });
    if (exists) throw new ConflictException("username already taken");
    const user = await this.prisma.user.create({
      data: {
        username: input.username,
        passwordHash: await bcrypt.hash(input.password, 10),
        displayName: input.displayName ?? null,
        jobTitle: input.jobTitle ?? null,
        role: input.role,
      },
    });
    return this.emit(user);
  }

  async update(id: string, patch: UserUpdateInput, actingUserId?: string) {
    const target = await this.getActive(id);
    if (patch.isActive === false && id === actingUserId) {
      throw new ForbiddenException("you cannot deactivate your own account");
    }
    // Guard: don't strip the last admin of ADMIN / don't deactivate them.
    const losingAdmin =
      target.role === "ADMIN" &&
      ((patch.role != null && patch.role !== "ADMIN") || patch.isActive === false);
    if (losingAdmin) await this.assertNotLastAdmin(id);
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        displayName: patch.displayName === undefined ? undefined : patch.displayName,
        jobTitle: patch.jobTitle === undefined ? undefined : patch.jobTitle,
        role: patch.role,
        isActive: patch.isActive,
      },
    });
    return this.emit(user);
  }

  async setActive(id: string, isActive: boolean, actingUserId?: string) {
    return this.update(id, { isActive }, actingUserId);
  }

  async setPresence(id: string, input: PresenceInput) {
    await this.getActive(id);
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        presence: input.presence as StaffPresence,
        presenceChangedAt: new Date(),
      },
    });
    return this.emit(user);
  }

  async resetPassword(id: string, input: PasswordResetInput) {
    await this.getActive(id);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash: await bcrypt.hash(input.password, 10) },
    });
    // Force re-login everywhere with the old password.
    await this.prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  async remove(id: string, actingUserId?: string) {
    const target = await this.getActive(id);
    if (id === actingUserId) {
      throw new ForbiddenException("you cannot delete your own account");
    }
    if (target.role === "ADMIN") await this.assertNotLastAdmin(id);

    const [items, payments, audits] = await Promise.all([
      this.prisma.ticketItem.count({ where: { addedByUserId: id } }),
      this.prisma.payment.count({ where: { receivedByUserId: id } }),
      this.prisma.auditLog.count({ where: { userId: id } }),
    ]);
    if (items + payments + audits > 0) {
      throw new ConflictException(
        "account has recorded activity — deactivate it instead of deleting",
      );
    }
    await this.prisma.user.delete({ where: { id } });
    this.events.emitEvent(ServiceEvent.USER_UPDATED, { id, deleted: true });
    return { ok: true };
  }

  // --- helpers ----------------------------------------------------------

  private async getActive(id: string) {
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!user) throw new NotFoundException("user not found");
    return user;
  }

  private async assertNotLastAdmin(excludeId: string) {
    const others = await this.prisma.user.count({
      where: { role: "ADMIN", isActive: true, deletedAt: null, id: { not: excludeId } },
    });
    if (others === 0) throw new ConflictException("at least one active admin is required");
  }

  private emit(user: Parameters<typeof toPublicUser>[0]) {
    const pub = toPublicUser(user);
    this.events.emitEvent(ServiceEvent.USER_UPDATED, pub);
    return pub;
  }
}
