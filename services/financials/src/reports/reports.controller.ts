import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import { ApiQuery, ApiTags } from "@nestjs/swagger";
import { Exportable, Role, Roles } from "@mms/shared";
import { ProfitGrouping, ReportsService } from "./reports.service";
import { VatMonth } from "./vat";

const GROUPINGS: ProfitGrouping[] = ["product", "store", "day"];

function required(from?: string, to?: string): [string, string] {
  if (!from || !to) throw new BadRequestException("from and to query params are required (YYYY-MM-DD)");
  return [from, to];
}

@ApiTags("reports")
@Roles(Role.OWNER, Role.MANAGER, Role.ACCOUNTANT)
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

  @Get("vat")
  @Exportable<VatMonth & { label: string }, never>(
    "vat-summary",
    [
      { header: "Month", value: (r) => r.label },
      { header: "Output VAT on sales (KES)", value: (r) => r.outputVat },
      { header: "VAT refunded on returns (KES)", value: (r) => r.refundedVat },
      { header: "Other adjustments (KES)", value: (r) => r.otherAdjustments },
      { header: "Net VAT (KES)", value: (r) => r.netVat },
    ],
    (_items, result: { months: VatMonth[]; total: Omit<VatMonth, "month"> }) => [
      ...result.months.map((m) => ({ ...m, label: m.month })),
      { ...result.total, month: "", label: "Total" },
    ],
  )
  @ApiQuery({ name: "from", description: "YYYY-MM-DD" })
  @ApiQuery({ name: "to", description: "YYYY-MM-DD, inclusive" })
  vat(@Query("from") from?: string, @Query("to") to?: string) {
    return this.reports.vat(...required(from, to));
  }

  @Get("summary")
  @ApiQuery({ name: "from", description: "YYYY-MM-DD" })
  @ApiQuery({ name: "to", description: "YYYY-MM-DD, inclusive" })
  summary(@Query("from") from?: string, @Query("to") to?: string) {
    return this.reports.summary(...required(from, to));
  }
}
