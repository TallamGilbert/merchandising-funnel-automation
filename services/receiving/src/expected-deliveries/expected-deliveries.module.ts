import { Module } from "@nestjs/common";
import { EventBusModule } from "@mms/shared";
import { ExpectedDeliveriesController } from "./expected-deliveries.controller";
import { ExpectedDeliveriesService } from "./expected-deliveries.service";
import { PurchaseOrderApprovedConsumer } from "./purchase-order-approved.consumer";

@Module({
  imports: [EventBusModule],
  controllers: [ExpectedDeliveriesController],
  providers: [ExpectedDeliveriesService, PurchaseOrderApprovedConsumer],
  exports: [ExpectedDeliveriesService],
})
export class ExpectedDeliveriesModule {}
