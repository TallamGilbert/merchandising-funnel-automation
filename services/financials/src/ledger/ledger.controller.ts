import { Controller, Get, ParseEnumPipe, ParseIntPipe, Query } from "@nestjs/common";
import { ApiQuery, ApiTags } from "@nestjs/swagger";
import { EntrySource } from "../generated/prisma";
import { LedgerService } from "./ledger.service";

@ApiTags("ledger")
@Controller("ledger")
export class LedgerController {
  constructor(private readonly ledger: LedgerService) {}

  @Get("entries")
  @ApiQuery({ name: "from", required: false, description: "YYYY-MM-DD" })
  @ApiQuery({ name: "to", required: false, description: "YYYY-MM-DD, inclusive" })
  @ApiQuery({ name: "accountCode", required: false })
  @ApiQuery({ name: "source", enum: EntrySource, required: false })
  @ApiQuery({ name: "limit", required: false, description: "Default 100, max 500" })
  entries(
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("accountCode") accountCode?: string,
    @Query("source", new ParseEnumPipe(EntrySource, { optional: true })) source?: EntrySource,
    @Query("limit", new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.ledger.entries({ from, to, accountCode, source, limit });
  }

  @Get("trial-balance")
  @ApiQuery({ name: "asOf", required: false, description: "YYYY-MM-DD, inclusive; default today" })
  trialBalance(@Query("asOf") asOf?: string) {
    return this.ledger.trialBalance(asOf);
  }
}
