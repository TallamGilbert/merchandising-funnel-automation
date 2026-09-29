import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import { ApiQuery, ApiTags } from "@nestjs/swagger";
import { ProfitGrouping, ReportsService } from "./reports.service";

const GROUPINGS: ProfitGrouping[] = ["product", "store", "day"];

function required(from?: string, to?: string): [string, string] {
  if (!from || !to) throw new BadRequestException("from and to query params are required (YYYY-MM-DD)");
  return [from, to];
}

@ApiTags("reports")
@Controller("reports")
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get("profitability")
  @ApiQuery({ name: "from", description: "YYYY-MM-DD" })
  @ApiQuery({ name: "to", description: "YYYY-MM-DD, inclusive" })
  @ApiQuery({ name: "groupBy", enum: GROUPINGS, required: false })
  profitability(@Query("from") from?: string, @Query("to") to?: string, @Query("groupBy") groupBy?: string) {
    const grouping = (groupBy ?? "product") as ProfitGrouping;
    if (!GROUPINGS.includes(grouping)) throw new BadRequestException(`groupBy must be one of ${GROUPINGS.join(", ")}`);
    return this.reports.profitability(...required(from, to), grouping);
  }

  @Get("summary")
  @ApiQuery({ name: "from", description: "YYYY-MM-DD" })
  @ApiQuery({ name: "to", description: "YYYY-MM-DD, inclusive" })
  summary(@Query("from") from?: string, @Query("to") to?: string) {
    return this.reports.summary(...required(from, to));
  }
}
