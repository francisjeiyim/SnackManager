import { Module } from "@nestjs/common";
import { TicketsController } from "./tickets.controller";
import { TicketsService } from "./tickets.service";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";

@Module({
  controllers: [TicketsController, PaymentsController],
  providers: [TicketsService, PaymentsService],
  exports: [TicketsService, PaymentsService],
})
export class TicketsModule {}
