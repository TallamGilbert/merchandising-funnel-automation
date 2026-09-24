import { BadRequestException, Controller, Get, Param, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { LedgerService } from "./ledger.service";

@ApiTags("ledger")
@Controller("stores")
export class LedgerController {
  constructor(private readonly ledger: LedgerService) {}

  @Get(":storeId/ledger")
  async get(@Param("storeId") storeId: string, @Query("businessDate") businessDate?: string) {
    if (!businessDate) throw new BadRequestException("businessDate query param is required (YYYY-MM-DD)");
    return this.ledger.getLedger(storeId, businessDate);
  }
}
