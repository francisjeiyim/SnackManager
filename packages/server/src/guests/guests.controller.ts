import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from "@nestjs/common";
import {
  schemas,
  UserRole,
  type AssignGuestInput,
  type ExtendGuestInput,
  type GuestPatchInput,
  type MoveGuestInput,
  type SeatInInput,
} from "@snackmanager/shared";
import { ZodBody } from "../common/zod-validation.pipe";
import { CurrentUser, Roles, type AuthUser } from "../common/decorators";
import { GuestsService } from "./guests.service";
import { TicketsService } from "../tickets/tickets.service";

@Roles(UserRole.SERVER, UserRole.CASHIER)
@Controller("guests")
export class GuestsController {
  constructor(
    private readonly guests: GuestsService,
    private readonly tickets: TicketsService,
  ) {}

  @Get("active")
  active() {
    return this.guests.active();
  }

  @Get("assignable-staff")
  assignableStaff() {
    return this.guests.assignableStaff();
  }

  @Post("seat-in")
  seatIn(@Body(new ZodBody(schemas.seatInSchema)) dto: SeatInInput, @CurrentUser() user: AuthUser) {
    return this.tickets.seatIn(dto, user?.id);
  }

  @Patch(":id/move")
  move(
    @Param("id") id: string,
    @Body(new ZodBody(schemas.moveGuestSchema.omit({ guestId: true }))) dto: { toSeatId: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.guests.move({ guestId: id, toSeatId: dto.toSeatId } as MoveGuestInput, user?.id);
  }

  @Post(":id/seat-out")
  seatOut(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.guests.seatOut(id, user?.id);
  }

  @Post(":id/extend")
  extend(
    @Param("id") id: string,
    @Body(new ZodBody(schemas.extendGuestSchema)) dto: ExtendGuestInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.guests.extendGuest(id, dto.kind, user?.id);
  }

  @Delete(":id/extension")
  undoExtension(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.guests.undoLastExtension(id, user?.id);
  }

  @Patch(":id")
  rename(
    @Param("id") id: string,
    @Body(new ZodBody(schemas.guestPatchSchema)) dto: GuestPatchInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.guests.rename(id, dto.displayName, user?.id);
  }

  @Put(":id/assignment")
  assign(
    @Param("id") id: string,
    @Body(new ZodBody(schemas.assignGuestSchema)) dto: AssignGuestInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.guests.assign(id, dto.userId, user?.id);
  }

  @Delete(":id/assignment")
  unassign(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.guests.unassign(id, user?.id);
  }
}
