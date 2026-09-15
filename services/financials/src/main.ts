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
  app.useGlobalGuards(FeatureFlagGuard.forModule(ModuleKey.FINANCIALS));

  const config = new DocumentBuilder()
    .setTitle("Financials Service")
    .setDescription("Phase 4 scaffold. Automated bookkeeper translating domain events into ledger entries (FR-8.x).")
    .setVersion("0.1.0")
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("docs", app, document);

  const port = process.env.PORT ?? 3008;
  await app.listen(port);
  console.log(`[financials] listening on port ${port} (Swagger UI at /docs)`);
}

void bootstrap();
