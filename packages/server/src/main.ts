import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { Logger } from "@nestjs/common";
import { AppModule } from "./app.module";
import type { AppConfig } from "./config/configuration";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { cors: false });

  const config = app.get(ConfigService).get<AppConfig>("app", { infer: true });
  if (!config) throw new Error("app config missing");

  app.enableCors({ origin: config.corsOrigins, credentials: true });
  app.setGlobalPrefix("api");
  app.enableShutdownHooks();

  await app.listen(config.port);
  Logger.log(`SnackManager API on http://localhost:${config.port}/api`, "Bootstrap");
}

void bootstrap();
