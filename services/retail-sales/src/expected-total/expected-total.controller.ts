import { BadRequestException, Controller, Get, Param, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ExpectedTotalService } from "./expected-total.service";

@ApiTags("expected-total")
@Controller("stores")
export class ExpectedTotalController {
  constructor(private readonly expectedTotal: ExpectedTotalService) {}

  @Get(":storeId/expected-total")
  get(@Param("storeId") storeId: string, @Query("businessDate") businessDate?: string) {
    if (!businessDate) throw new BadRequestException("businessDate query param is required (YYYY-MM-DD)");
    return this.expectedTotal.getExpectedTotal(storeId, businessDate);
  }
}
