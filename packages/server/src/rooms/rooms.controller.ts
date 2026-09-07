import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { schemas, UserRole, type RoomInput } from "@snackmanager/shared";
import { ZodBody } from "../common/zod-validation.pipe";
import { Roles } from "../common/decorators";
import { RoomsService } from "./rooms.service";

const roomPatchSchema = schemas.roomInputSchema.partial();

@Controller("rooms")
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Get()
  list() {
    return this.rooms.list();
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.rooms.get(id);
  }

  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body(new ZodBody(schemas.roomInputSchema)) dto: RoomInput) {
    return this.rooms.create(dto);
  }

  @Roles(UserRole.ADMIN)
  @Patch(":id")
  update(@Param("id") id: string, @Body(new ZodBody(roomPatchSchema)) dto: Partial<RoomInput>) {
    return this.rooms.update(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.rooms.remove(id);
  }
}
