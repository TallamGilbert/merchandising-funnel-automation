import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, Matches } from "class-validator";
import { SALES_GROUPINGS, SalesGrouping } from "./sales-report";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class SalesReportQuery {
  @ApiProperty({ example: "2026-10-01", description: "First day, YYYY-MM-DD (UTC, inclusive)" })
  @Matches(DAY, { message: "from must be YYYY-MM-DD" })
  from!: string;

  @ApiProperty({ example: "2026-10-31", description: "Last day, YYYY-MM-DD (UTC, inclusive)" })
  @Matches(DAY, { message: "to must be YYYY-MM-DD" })
  to!: string;

  @ApiPropertyOptional({ example: "STORE-1", description: "One store; omit for every store" })
  @IsOptional()
  @IsString()
  storeId?: string;

  @ApiPropertyOptional({ enum: SALES_GROUPINGS, default: "day" })
  @IsOptional()
  @IsIn(SALES_GROUPINGS)
  groupBy?: SalesGrouping;

  /** Accepted for exports; the report itself isn't paged. */
  @ApiPropertyOptional({ enum: ["csv", "xlsx"] })
  @IsOptional()
  @IsIn(["csv", "xlsx"])
  format?: string;
}
