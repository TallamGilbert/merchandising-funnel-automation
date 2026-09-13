import { Module } from "@nestjs/common";
import { StockModule } from "../stock/stock.module";
import { ValuationController } from "./valuation.controller";

@Module({
  imports: [StockModule],
  controllers: [ValuationController],
})
export class ValuationModule {}
