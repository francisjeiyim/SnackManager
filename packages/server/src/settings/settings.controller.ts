import { Body, Controller, Get, Put } from "@nestjs/common";
import { schemas, UserRole, type SettingsUpdateInput } from "@snackmanager/shared";
import { ZodBody } from "../common/zod-validation.pipe";
import { Roles } from "../common/decorators";
import { SettingsService } from "./settings.service";

@Controller("settings")
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  get() {
    return this.settings.get();
  }

  @Roles(UserRole.ADMIN)
  @Put()
  update(@Body(new ZodBody(schemas.settingsUpdateSchema)) dto: SettingsUpdateInput) {
    return this.settings.update(dto);
  }
}
