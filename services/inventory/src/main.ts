import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { MicroserviceOptions, Transport } from "@nestjs/microservices";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import {
  FeatureFlagGuard,
  INVENTORY_GRPC_PACKAGE,
  inventoryProtoPath,
  ModuleKey,
} from "@mms/shared";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalGuards(FeatureFlagGuard.forModule(ModuleKey.INVENTORY));

  // NFR-5 / FR-4.5 / FR-6.2 — the one latency-sensitive sync path in the
  // system (Retail Sales checkout stock check) runs over gRPC, hosted
  // alongside the REST API in the same process as a hybrid application.
  const grpcPort = process.env.INVENTORY_GRPC_PORT ?? "5003";
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: INVENTORY_GRPC_PACKAGE,
      protoPath: inventoryProtoPath(),
      url: `0.0.0.0:${grpcPort}`,
    },
  });

  const config = new DocumentBuilder()
    .setTitle("Inventory Service")
    .setDescription(
      "Single source of truth for stock levels, valuation, and product master data (FR-4.x). " +
        "REST is documented here; the checkout stock-check RPC lives in contracts/proto/inventory.proto.",
    )
    .setVersion("0.1.0")
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("docs", app, document);

  await app.startAllMicroservices();

  const port = process.env.PORT ?? 3003;
  await app.listen(port);
  console.log(
    `[inventory] REST listening on port ${port} (Swagger UI at /docs), gRPC listening on port ${grpcPort}`,
  );
}

void bootstrap();
