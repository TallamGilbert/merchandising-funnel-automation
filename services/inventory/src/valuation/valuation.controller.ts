import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { StockService } from "../stock/stock.service";

@ApiTags("valuation")
@Controller("valuation")
export class ValuationController {
  constructor(private readonly stock: StockService) {}

  @Get()
  report() {
    return this.stock.valuationReport();
  }
}
