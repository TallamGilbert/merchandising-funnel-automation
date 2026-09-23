import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { FeatureFlagGuard, ModuleKey } from "@mms/shared";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalGuards(FeatureFlagGuard.forModule(ModuleKey.WAREHOUSE_OPERATIONS));

  const config = new DocumentBuilder()
    .setTitle("Warehouse Operations Service")
    .setDescription("Directs putaway, picking, and stock transfers (FR-5.x).")
    .setVersion("0.1.0")
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("docs", app, document);

  const port = process.env.PORT ?? 3005;
  await app.listen(port);
  console.log(`[warehouse-operations] listening on port ${port} (Swagger UI at /docs)`);
}

void bootstrap();
