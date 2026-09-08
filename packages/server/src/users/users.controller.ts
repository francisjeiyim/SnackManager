import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import {
  schemas,
  UserRole,
  type PasswordResetInput,
  type PresenceInput,
  type UserCreateInput,
  type UserUpdateInput,
} from "@snackmanager/shared";
import { z } from "zod";
import { ZodBody } from "../common/zod-validation.pipe";
import { CurrentUser, Roles, type AuthUser } from "../common/decorators";
import { UsersService } from "./users.service";

const activeSchema = z.object({ isActive: z.boolean() });

@Roles(UserRole.ADMIN)
@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list() {
    return this.users.list();
  }

  @Post()
  create(@Body(new ZodBody(schemas.userCreateSchema)) dto: UserCreateInput) {
    return this.users.create(dto);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(new ZodBody(schemas.userUpdateSchema)) dto: UserUpdateInput,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.users.update(id, dto, actor?.id);
  }

  @Patch(":id/active")
  setActive(
    @Param("id") id: string,
    @Body(new ZodBody(activeSchema)) dto: { isActive: boolean },
    @CurrentUser() actor: AuthUser,
  ) {
    return this.users.setActive(id, dto.isActive, actor?.id);
  }

  @Patch(":id/presence")
  setPresence(
    @Param("id") id: string,
    @Body(new ZodBody(schemas.presenceSchema)) dto: PresenceInput,
  ) {
    return this.users.setPresence(id, dto);
  }

  @Post(":id/password")
  resetPassword(
    @Param("id") id: string,
    @Body(new ZodBody(schemas.passwordResetSchema)) dto: PasswordResetInput,
  ) {
    return this.users.resetPassword(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() actor: AuthUser) {
    return this.users.remove(id, actor?.id);
  }
}
