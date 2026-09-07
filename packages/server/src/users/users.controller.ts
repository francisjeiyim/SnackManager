import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { schemas, UserRole, type UserCreateInput } from "@snackmanager/shared";
import { z } from "zod";
import { ZodBody } from "../common/zod-validation.pipe";
import { Roles } from "../common/decorators";
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

  @Patch(":id/active")
  setActive(@Param("id") id: string, @Body(new ZodBody(activeSchema)) dto: { isActive: boolean }) {
    return this.users.setActive(id, dto.isActive);
  }
}
