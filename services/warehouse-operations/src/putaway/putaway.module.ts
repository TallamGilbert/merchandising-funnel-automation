import { Module } from "@nestjs/common";
import { EventBusModule } from "@mms/shared";
import { InventoryClientModule } from "../inventory-client/inventory-client.module";
import { GoodsReceivedConsumer } from "./goods-received.consumer";
import { PutawayController } from "./putaway.controller";
import { PutawayService } from "./putaway.service";

@Module({
  imports: [InventoryClientModule, EventBusModule],
  controllers: [PutawayController],
  providers: [PutawayService, GoodsReceivedConsumer],
})
export class PutawayModule {}
