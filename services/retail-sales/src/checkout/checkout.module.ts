import { Module } from "@nestjs/common";
import { EventBusModule } from "@mms/shared";
import { InventoryGrpcClientModule } from "../inventory-grpc-client/inventory-grpc-client.module";
import { ProductsModule } from "../products/products.module";
import { CheckoutController } from "./checkout.controller";
import { CheckoutService } from "./checkout.service";

@Module({
  imports: [ProductsModule, InventoryGrpcClientModule, EventBusModule],
  controllers: [CheckoutController],
  providers: [CheckoutService],
})
export class CheckoutModule {}
