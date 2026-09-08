import { Injectable } from "@nestjs/common";
import { ServiceEvent, type SettingsUpdateInput } from "@snackmanager/shared";
import { PrismaService } from "../prisma/prisma.service";
import { EventsGateway } from "../events/events.gateway";
import { toSettings, toBillingSettings } from "../common/mappers";

const SETTINGS_ID = "settings";

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
  ) {}

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
    const settings = toSettings(row);
    // Fan out to every connected client so rate/min, alert windows, rounding,
    // service-day cutover… take effect live on the cashier and server screens.
    this.events.emitEvent(ServiceEvent.SETTINGS_UPDATED, settings);
    return settings;
  }
}
