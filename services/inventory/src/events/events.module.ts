import { Module } from "@nestjs/common";
import { EventBusModule } from "@mms/shared";
import { StockModule } from "../stock/stock.module";
import { GoodsReceivedConsumer } from "./goods-received.consumer";
import { ItemSoldConsumer } from "./item-sold.consumer";
import { StockTransferredConsumer } from "./stock-transferred.consumer";

@Module({
  imports: [EventBusModule, StockModule],
  providers: [GoodsReceivedConsumer, ItemSoldConsumer, StockTransferredConsumer],
})
export class EventsModule {}
