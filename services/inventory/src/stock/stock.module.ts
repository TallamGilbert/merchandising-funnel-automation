import { Module } from "@nestjs/common";
import { EventBusModule } from "@mms/shared";
import { StockLevelsController } from "./stock-levels.controller";
import { StockService } from "./stock.service";

@Module({
  imports: [EventBusModule],
  controllers: [StockLevelsController],
  providers: [StockService],
  exports: [StockService],
})
export class StockModule {}
