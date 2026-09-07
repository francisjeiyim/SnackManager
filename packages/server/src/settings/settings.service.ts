import { Injectable } from "@nestjs/common";
import type { SettingsUpdateInput } from "@snackmanager/shared";
import { PrismaService } from "../prisma/prisma.service";
import { toSettings, toBillingSettings } from "../common/mappers";

const SETTINGS_ID = "settings";

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** The singleton settings row, created with defaults on first read. */
  async getRaw() {
    return this.prisma.settings.upsert({
      where: { id: SETTINGS_ID },
      create: { id: SETTINGS_ID },
      update: {},
    });
  }

  async get() {
    return toSettings(await this.getRaw());
  }

  async billing() {
    return toBillingSettings(await this.getRaw());
  }

  async update(input: SettingsUpdateInput) {
    await this.getRaw();
    const row = await this.prisma.settings.update({ where: { id: SETTINGS_ID }, data: input });
    return toSettings(row);
  }
}
