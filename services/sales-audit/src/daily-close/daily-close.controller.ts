import { BadRequestException, Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AuthUser, CurrentUser, Role, Roles } from "@mms/shared";
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

  @Get(":storeId/open-days")
  openDays(@Param("storeId") storeId: string) {
    return this.dailyClose.openDays(storeId);
  }

  @Post(":storeId/daily-close/count")
  @Roles(Role.OWNER, Role.MANAGER, Role.CASHIER)
  recordCount(@Param("storeId") storeId: string, @Body() dto: RecordCountDto) {
    return this.dailyClose.recordCount(storeId, dto.businessDate, dto.actualCountedTotal);
  }

  @Post(":storeId/daily-close/explain")
  @Roles(Role.OWNER, Role.MANAGER)
  explain(@Param("storeId") storeId: string, @Body() dto: ExplainDiscrepancyDto) {
    return this.dailyClose.explainDiscrepancy(storeId, dto.businessDate, dto.explanation);
  }

  @Post(":storeId/daily-close/close")
  @Roles(Role.OWNER, Role.MANAGER)
  close(@CurrentUser() user: AuthUser, @Param("storeId") storeId: string, @Body() dto: CloseDailyDto) {
    return this.dailyClose.close(storeId, dto.businessDate, user.id);
  }
}
