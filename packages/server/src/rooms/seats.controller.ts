import { Body, Controller, Delete, Param, Patch, Post } from "@nestjs/common";
import { schemas, UserRole, type SeatInput, type SeatPatch } from "@snackmanager/shared";
import { z } from "zod";
import { ZodBody } from "../common/zod-validation.pipe";
import { Roles } from "../common/decorators";
import { SeatsService } from "./seats.service";

const bulkSchema = z.object({
  roomId: z.string().min(1),
  seats: z.array(schemas.seatPatchSchema.extend({ id: z.string().min(1) })).min(1),
});

@Roles(UserRole.ADMIN)
@Controller("seats")
export class SeatsController {
  constructor(private readonly seats: SeatsService) {}

  @Post()
  create(@Body(new ZodBody(schemas.seatInputSchema)) dto: SeatInput) {
    return this.seats.create(dto);
  }

  @Patch("bulk")
  bulk(@Body(new ZodBody(bulkSchema)) dto: z.infer<typeof bulkSchema>) {
    return this.seats.bulkUpdate(dto.roomId, dto.seats as Array<{ id: string } & SeatPatch>);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body(new ZodBody(schemas.seatPatchSchema)) dto: SeatPatch) {
    return this.seats.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.seats.remove(id);
  }
}
