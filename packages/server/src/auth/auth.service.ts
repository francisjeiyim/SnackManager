import { createHash, randomBytes } from "node:crypto";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import type { LoginInput } from "@snackmanager/shared";
import type { AppConfig } from "../config/configuration";
import { PrismaService } from "../prisma/prisma.service";
import { toPublicUser } from "../common/mappers";
import type { JwtPayload } from "./jwt.strategy";

const sha256 = (s: string): string => createHash("sha256").update(s).digest("hex");

@Injectable()
export class AuthService {
  private readonly cfg: AppConfig;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    config: ConfigService<{ app: AppConfig }, true>,
  ) {
    this.cfg = config.get("app", { infer: true });
  }

  async login(input: LoginInput) {
    const user = await this.prisma.user.findUnique({ where: { username: input.username } });
    if (!user || !user.isActive || !(await bcrypt.compare(input.password, user.passwordHash))) {
      throw new UnauthorizedException("invalid credentials");
    }
    return this.issueTokens({ sub: user.id, username: user.username, role: user.role }).then(
      (tokens) => ({ user: toPublicUser(user), ...tokens }),
    );
  }

  async refresh(refreshToken: string) {
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(refreshToken) },
      include: { user: true },
    });
    if (!record || record.revokedAt || record.expiresAt < new Date() || !record.user.isActive) {
      throw new UnauthorizedException("invalid refresh token");
    }
    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });
    return this.issueTokens({
      sub: record.user.id,
      username: record.user.username,
      role: record.user.role,
    });
  }

  async logout(refreshToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: sha256(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokens(payload: JwtPayload) {
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.cfg.jwt.accessSecret,
      expiresIn: this.cfg.jwt.accessTtl,
    });
    const refreshToken = randomBytes(48).toString("base64url");
    const ttlDays = Number.parseInt(this.cfg.jwt.refreshTtl, 10) || 30;
    await this.prisma.refreshToken.create({
      data: {
        userId: payload.sub,
        tokenHash: sha256(refreshToken),
        expiresAt: new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000),
      },
    });
    return { accessToken, refreshToken };
  }
}
