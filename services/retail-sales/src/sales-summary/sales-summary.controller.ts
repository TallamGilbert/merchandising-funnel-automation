import { BadRequestException, Controller, Get, Param, Query } from "@nestjs/common";
import { ApiQuery, ApiTags } from "@nestjs/swagger";
import { SalesSummaryService } from "./sales-summary.service";

@ApiTags("sales-summary")
@Controller("stores")
export class SalesSummaryController {
  constructor(private readonly summary: SalesSummaryService) {}

  @Get(":storeId/sales-summary")
  @ApiQuery({ name: "from", description: "First business date, YYYY-MM-DD" })
  @ApiQuery({ name: "to", description: "Last business date (inclusive), YYYY-MM-DD" })
  get(@Param("storeId") storeId: string, @Query("from") from?: string, @Query("to") to?: string) {
    if (!from || !to) throw new BadRequestException("from and to query params are required (YYYY-MM-DD)");
    return this.summary.summarize(storeId, from, to);
  }
}
