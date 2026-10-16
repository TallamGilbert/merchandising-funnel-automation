import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from "class-validator";

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
/** An export ignores paging but stops here, so one request can't pull a whole table. */
export const EXPORT_MAX_ROWS = 50_000;

export const EXPORT_FORMATS = ["csv", "xlsx"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

/**
 * Paging, search and export for every list endpoint. Endpoints add their own
 * filters as further @Query params. With `format`, the endpoint returns a
 * file of every matching row (up to EXPORT_MAX_ROWS) instead of a page.
 */
export class ListQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1, description: "1-based page number" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: MAX_PAGE_SIZE, default: DEFAULT_PAGE_SIZE })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  pageSize: number = DEFAULT_PAGE_SIZE;

  @ApiPropertyOptional({ description: "Free-text search; each endpoint documents what it matches" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() || undefined : value))
  q?: string;

  @ApiPropertyOptional({ enum: EXPORT_FORMATS, description: "Download every matching row instead of a page" })
  @IsOptional()
  @IsIn(EXPORT_FORMATS)
  format?: ExportFormat;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A list that can also be narrowed to an inclusive range of UTC days (see dateRange). */
export class DateRangeQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ description: "YYYY-MM-DD, inclusive" })
  @IsOptional()
  @Matches(DAY, { message: "from must be YYYY-MM-DD" })
  from?: string;

  @ApiPropertyOptional({ description: "YYYY-MM-DD, inclusive" })
  @IsOptional()
  @Matches(DAY, { message: "to must be YYYY-MM-DD" })
  to?: string;
}
