import { Module } from "@nestjs/common";
import { EventBusModule } from "@mms/shared";
import { StockCountsController } from "./stock-counts.controller";
import { StockCountsService } from "./stock-counts.service";

@Module({
  imports: [EventBusModule],
  controllers: [StockCountsController],
  providers: [StockCountsService],
})
export class StockCountsModule {}
