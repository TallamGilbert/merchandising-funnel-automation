import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { INVENTORY_GRPC_PACKAGE, INVENTORY_GRPC_SERVICE, inventoryProtoPath } from "@mms/shared";
import { InventoryGrpcClientService } from "./inventory-grpc-client.service";

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: INVENTORY_GRPC_SERVICE,
        imports: [ConfigModule],
        useFactory: (config: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: INVENTORY_GRPC_PACKAGE,
            protoPath: inventoryProtoPath(),
            url: config.get<string>("INVENTORY_GRPC_URL") ?? "localhost:5003",
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  providers: [InventoryGrpcClientService],
  exports: [InventoryGrpcClientService],
})
export class InventoryGrpcClientModule {}
