import { Controller, Get, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { StockService } from "./stock.service";

@ApiTags("stock-levels")
@Controller("stock-levels")
export class StockLevelsController {
  constructor(private readonly stock: StockService) {}

  @Get()
  list(@Query("locationCode") locationCode?: string) {
    return this.stock.listStockLevels(locationCode);
  }
}
