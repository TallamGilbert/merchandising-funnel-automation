import { Module } from "@nestjs/common";
import { EventBusModule } from "@mms/shared";
import { VendorManagementClientModule } from "../vendor-management-client/vendor-management-client.module";
import { GoodsReceivedConsumer } from "./goods-received.consumer";
import { PurchaseOrdersController } from "./purchase-orders.controller";
import { PurchaseOrdersService } from "./purchase-orders.service";

@Module({
  imports: [VendorManagementClientModule, EventBusModule],
  controllers: [PurchaseOrdersController],
  providers: [PurchaseOrdersService, GoodsReceivedConsumer],
  exports: [PurchaseOrdersService],
})
export class PurchaseOrdersModule {}
