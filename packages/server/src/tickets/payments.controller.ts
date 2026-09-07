import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { z } from "zod";
import { schemas, UserRole } from "@snackmanager/shared";
import { ZodBody } from "../common/zod-validation.pipe";
import { CurrentUser, Roles, type AuthUser } from "../common/decorators";
import { PaymentsService } from "./payments.service";

const paymentBody = z.object({
  amountYen: z.number().int().positive(),
  method: schemas.paymentMethodSchema,
  reference: z.string().max(120).nullable().optional(),
});

@Roles(UserRole.CASHIER)
@Controller("tickets")
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get(":id/payments")
  list(@Param("id") id: string) {
    return this.payments.listForTicket(id);
  }

  @Post(":id/payments")
  take(
    @Param("id") id: string,
    @Body(new ZodBody(paymentBody)) dto: z.infer<typeof paymentBody>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.payments.take({ ...dto, ticketId: id }, user?.id);
  }
}
