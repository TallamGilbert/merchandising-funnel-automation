import { BadRequestException, Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CloseDailyDto } from "./dto/close-daily.dto";
import { ExplainDiscrepancyDto } from "./dto/explain-discrepancy.dto";
import { RecordCountDto } from "./dto/record-count.dto";
import { DailyCloseService } from "./daily-close.service";

@ApiTags("daily-close")
@Controller("stores")
export class DailyCloseController {
  constructor(private readonly dailyClose: DailyCloseService) {}

  @Get(":storeId/daily-close")
  get(@Param("storeId") storeId: string, @Query("businessDate") businessDate?: string) {
    if (!businessDate) throw new BadRequestException("businessDate query param is required (YYYY-MM-DD)");
    return this.dailyClose.get(storeId, businessDate);
  }

  @Post(":storeId/daily-close/count")
  recordCount(@Param("storeId") storeId: string, @Body() dto: RecordCountDto) {
    return this.dailyClose.recordCount(storeId, dto.businessDate, dto.actualCountedTotal);
  }

  @Post(":storeId/daily-close/explain")
  explain(@Param("storeId") storeId: string, @Body() dto: ExplainDiscrepancyDto) {
    return this.dailyClose.explainDiscrepancy(storeId, dto.businessDate, dto.explanation);
  }

  @Post(":storeId/daily-close/close")
  close(@Param("storeId") storeId: string, @Body() dto: CloseDailyDto) {
    return this.dailyClose.close(storeId, dto.businessDate, dto.closedByManagerId);
  }
}
