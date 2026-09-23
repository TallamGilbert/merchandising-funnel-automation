import { Module } from "@nestjs/common";
import { EventBusModule } from "@mms/shared";
import { ExpectedDeliveriesModule } from "../expected-deliveries/expected-deliveries.module";
import { ProcurementClientModule } from "../procurement-client/procurement-client.module";
import { GoodsReceivedNotesController } from "./goods-received-notes.controller";
import { GoodsReceivedNotesService } from "./goods-received-notes.service";

@Module({
  imports: [ExpectedDeliveriesModule, ProcurementClientModule, EventBusModule],
  controllers: [GoodsReceivedNotesController],
  providers: [GoodsReceivedNotesService],
})
export class GoodsReceivedNotesModule {}
