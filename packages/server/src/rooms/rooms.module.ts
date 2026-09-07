import { Module } from "@nestjs/common";
import { RoomsController } from "./rooms.controller";
import { RoomsService } from "./rooms.service";
import { SeatsController } from "./seats.controller";
import { SeatsService } from "./seats.service";

@Module({
  controllers: [RoomsController, SeatsController],
  providers: [RoomsService, SeatsService],
  exports: [RoomsService, SeatsService],
})
export class RoomsModule {}
