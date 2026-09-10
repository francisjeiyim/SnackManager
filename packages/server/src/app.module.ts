import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { loadConfig } from "./config/configuration";
import { AllExceptionsFilter } from "./common/http-exception.filter";
import { JwtAuthGuard, RolesGuard } from "./common/guards";
import { PrismaModule } from "./prisma/prisma.module";
import { EventsModule } from "./events/events.module";
import { AuditModule } from "./audit/audit.module";
import { SettingsModule } from "./settings/settings.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { RoomsModule } from "./rooms/rooms.module";
import { ProductsModule } from "./products/products.module";
import { TicketsModule } from "./tickets/tickets.module";
import { GuestsModule } from "./guests/guests.module";
import { AdminModule } from "./admin/admin.module";
import { HealthController } from "./health.controller";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", "../../.env"],
      load: [() => ({ app: loadConfig() })],
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    PrismaModule,
    EventsModule,
    AuditModule,
    SettingsModule,
    AuthModule,
    UsersModule,
    RoomsModule,
    ProductsModule,
    TicketsModule,
    GuestsModule,
    AdminModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
