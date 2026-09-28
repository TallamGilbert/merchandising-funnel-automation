import { Controller, Get, Param, ParseIntPipe, Query } from "@nestjs/common";
import { ApiQuery, ApiTags } from "@nestjs/swagger";
import { TransactionsService } from "./transactions.service";

@ApiTags("transactions")
@Controller("transactions")
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Get()
  @ApiQuery({ name: "storeId", required: false })
  @ApiQuery({ name: "limit", required: false, description: "Default 50, max 200" })
  list(
    @Query("storeId") storeId?: string,
    @Query("limit", new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.transactions.listRecent(storeId, limit);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.transactions.findOne(id);
  }
}
