import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiTags } from "@nestjs/swagger";
import { dateRange, Exportable, Role, Roles } from "@mms/shared";
import { buildSalesReport, SalesReportRow } from "./sales-report";
import { SalesReportQuery } from "./sales-report.query";
import { SalesReportRepository } from "./sales-report.repository";

const MAX_DAYS = 366;

/**
 * D-20 — sales by cashier, hour of day, day, product or store over a range
 * of UTC days. Hours are in REPORT_TIMEZONE (default Africa/Nairobi).
 */
@ApiTags("reports")
@Roles(Role.OWNER, Role.MANAGER, Role.ACCOUNTANT)
@Controller("reports")
export class SalesReportController {
  private readonly timeZone: string;

  constructor(
    private readonly repository: SalesReportRepository,
    config: ConfigService,
  ) {
    this.timeZone = config.get<string>("REPORT_TIMEZONE") ?? "Africa/Nairobi";
  }

  @Get("sales")
  @Exportable<SalesReportRow>("sales-report", [
    { header: "Group", value: (r) => r.key },
    { header: "Name", value: (r) => r.label },
    { header: "Transactions", value: (r) => r.transactions },
    { header: "Units sold", value: (r) => r.units },
    { header: "Sales (KES)", value: (r) => r.sales },
    { header: "Discounts (KES)", value: (r) => r.discounts },
    { header: "VAT (KES)", value: (r) => r.vat },
    { header: "Returns (KES)", value: (r) => r.returns },
    { header: "Units returned", value: (r) => r.unitsReturned },
    { header: "Net (KES)", value: (r) => r.net },
  ])
  async sales(@Query() query: SalesReportQuery): Promise<SalesReportRow[]> {
    const range = dateRange(query.from, query.to);
    if (!range?.gte || !range.lt || range.lt <= range.gte) throw new BadRequestException("to must be on or after from");
    if ((range.lt.getTime() - range.gte.getTime()) / 86_400_000 > MAX_DAYS) {
      throw new BadRequestException(`The range can be at most ${MAX_DAYS} days`);
    }
    const [sales, returns] = await Promise.all([
      this.repository.findSales(range.gte, range.lt, query.storeId),
      this.repository.findReturns(range.gte, range.lt, query.storeId),
    ]);
    return buildSalesReport(sales, returns, query.groupBy ?? "day", this.timeZone);
  }
}
