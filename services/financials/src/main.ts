import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory, Reflector } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AuthGuard, authSecret, corsOptions, FeatureFlagGuard, ModuleKey } from "@mms/shared";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  authSecret(); // fail at startup, not on the first request, if AUTH_JWT_SECRET is missing
  app.enableCors(corsOptions());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalGuards(FeatureFlagGuard.forModule(ModuleKey.FINANCIALS), new AuthGuard(app.get(Reflector)));

  if (process.env.SWAGGER_ENABLED !== "false") {
    const config = new DocumentBuilder()
      .setTitle("Financials Service")
      .setDescription("Automated bookkeeper: turns goods received, sales, returns and day closes into double-entry ledger postings, accounts payable and profitability reports (FR-8.x).")
      .setVersion("0.1.0")
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup("docs", app, document);
  }

  const port = process.env.PORT ?? 3008;
  await app.listen(port);
  console.log(`[financials] listening on port ${port} (Swagger UI at /docs)`);
}

void bootstrap();
