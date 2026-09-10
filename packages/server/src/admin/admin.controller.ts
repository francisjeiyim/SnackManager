import { Body, Controller, Post } from "@nestjs/common";
import { z } from "zod";
import { UserRole } from "@snackmanager/shared";
import { ZodBody } from "../common/zod-validation.pipe";
import { CurrentUser, Roles, type AuthUser } from "../common/decorators";
import { AdminService } from "./admin.service";

const resetBody = z.object({ password: z.string().min(1).max(200) });

@Roles(UserRole.ADMIN)
@Controller("admin")
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Post("reset")
  reset(
    @Body(new ZodBody(resetBody)) dto: z.infer<typeof resetBody>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.admin.resetOperationalData(user?.id, dto.password);
  }
}
