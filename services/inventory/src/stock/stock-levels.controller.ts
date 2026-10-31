import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Exportable } from "@mms/shared";
import { ListStockLevelsQuery } from "./list-stock-levels.query";
import { StockService } from "./stock.service";

interface StockLevelRow {
  sku: string;
  productName: string;
  locationCode: string;
  onHand: number;
  allocated: number;
  available: number;
  unitValue: unknown;
}

@ApiTags("stock-levels")
@Controller("stock-levels")
export class StockLevelsController {
  constructor(private readonly stock: StockService) {}

  /** Declared before any `:param` route so "summary" is never read as one. */
  @Get("summary")
  summary(@Query("locationCode") locationCode?: string) {
    if (!locationCode) throw new BadRequestException("locationCode query param is required");
    return this.stock.locationSummary(locationCode);
  }

  @Get()
  @Exportable<StockLevelRow>("stock-levels", [
    { header: "SKU", value: (l) => l.sku },
    { header: "Product", value: (l) => l.productName },
    { header: "Location", value: (l) => l.locationCode },
    { header: "On hand", value: (l) => l.onHand },
    { header: "Allocated", value: (l) => l.allocated },
    { header: "Available", value: (l) => l.available },
    { header: "Unit value (KES)", value: (l) => Number(l.unitValue) },
  ])
  list(@Query() query: ListStockLevelsQuery) {
    return this.stock.listStockLevels(query);
  }
}
