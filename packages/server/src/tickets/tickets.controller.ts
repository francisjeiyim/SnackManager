import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { z } from "zod";
import {
  schemas,
  UserRole,
  type AddItemInput,
  type MergeInput,
  type SplitInputDto,
  type TicketPatchInput,
} from "@snackmanager/shared";
import { ZodBody } from "../common/zod-validation.pipe";
import { CurrentUser, Roles, type AuthUser } from "../common/decorators";
import { TicketsService } from "./tickets.service";

// Route bodies: `ticketId` comes from the path, so it is omitted here.
const addItemBody = z
  .object({
    productId: z.string().min(1).nullable().optional(),
    nameSnapshot: z.string().min(1).max(80).optional(),
    unitPriceYen: z.number().int().nonnegative().optional(),
    quantity: z.number().int().positive().default(1),
    guestId: z.string().min(1).nullable().optional(),
  })
  .refine((v) => v.productId != null || (v.nameSnapshot != null && v.unitPriceYen != null), {
    message: "provide productId, or both nameSnapshot and unitPriceYen",
  });

const splitBody = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("ITEMIZED"),
    guestIds: z.array(z.string()).default([]),
    itemIds: z.array(z.string()).default([]),
  }),
  z.object({ mode: z.literal("EVEN"), parts: z.number().int().min(2) }),
  z.object({
    mode: z.literal("GROUPS"),
    groups: z.array(z.array(z.string().min(1)).min(1)).min(2),
  }),
]);

const closeBody = z.object({
  closedAt: z.string().datetime().optional(),
  /** For guests past their paid time: add a set / half-set, or bill as-is. */
  overdueExtension: z.enum(["SET", "HALF", "NONE"]).optional(),
});

@Controller("tickets")
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Get("live")
  live() {
    return this.tickets.listLive();
  }

  @Get("unpaid")
  unpaid() {
    return this.tickets.listUnpaid();
  }

  @Get()
  list(
    @Query("status") status?: string,
    @Query("serviceDay") serviceDay?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.tickets.list({ status, serviceDay, from, to });
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.tickets.get(id);
  }

  @Roles(UserRole.SERVER, UserRole.CASHIER)
  @Post(":id/items")
  addItem(
    @Param("id") id: string,
    @Body(new ZodBody(addItemBody)) dto: z.infer<typeof addItemBody>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tickets.addItem({ ...dto, ticketId: id } as AddItemInput, user?.id);
  }

  @Roles(UserRole.SERVER, UserRole.CASHIER)
  @Patch(":id/items/:itemId/void")
  voidItem(
    @Param("id") id: string,
    @Param("itemId") itemId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tickets.voidItem(id, itemId, user?.id);
  }

  @Roles(UserRole.CASHIER)
  @Patch(":id")
  patch(
    @Param("id") id: string,
    @Body(new ZodBody(schemas.ticketPatchSchema)) dto: TicketPatchInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tickets.patch(id, dto, user?.id);
  }

  @Roles(UserRole.CASHIER)
  @Post(":id/close")
  close(
    @Param("id") id: string,
    @Body(new ZodBody(closeBody)) dto: z.infer<typeof closeBody>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tickets.close(id, dto.closedAt, user?.id, dto.overdueExtension ?? "NONE");
  }

  @Roles(UserRole.CASHIER)
  @Post(":id/writeoff")
  writeOff(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.tickets.writeOff(id, user?.id);
  }

  @Roles(UserRole.CASHIER)
  @Post("merge")
  merge(@Body(new ZodBody(schemas.mergeSchema)) dto: MergeInput, @CurrentUser() user: AuthUser) {
    return this.tickets.merge(dto, user?.id);
  }

  @Roles(UserRole.CASHIER)
  @Post(":id/split")
  split(
    @Param("id") id: string,
    @Body(new ZodBody(splitBody)) dto: z.infer<typeof splitBody>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tickets.split({ ...dto, ticketId: id } as SplitInputDto, user?.id);
  }
}
