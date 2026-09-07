import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

/**
 * Root module. Feature modules (auth, rooms, seats, products, parties, guests,
 * tickets, payments, settings, audit, events) are added in Phase 2.
 */
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
})
export class AppModule {}
