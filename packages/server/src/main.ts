import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  const origins = (process.env.CORS_ORIGINS ?? "http://localhost:5273")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  app.enableCors({ origin: origins, credentials: true });

  app.setGlobalPrefix("api");

  const port = Number(process.env.SERVER_PORT ?? 4100);
  await app.listen(port);
  Logger.log(`SnackManager API listening on http://localhost:${port}/api`, "Bootstrap");
}

void bootstrap();
