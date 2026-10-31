import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";
import { ListQueryDto } from "@mms/shared";
import { StockCountStatus, StockCountType } from "../../generated/prisma";

export class CreateStockCountDto {
  @ApiProperty({ example: "WH-MAIN" })
  @IsString()
  locationCode!: string;

  @ApiProperty({ enum: StockCountType, description: "FULL: everything held there. CYCLE: the skus or category given." })
  @IsEnum(StockCountType)
  type!: StockCountType;

  @ApiPropertyOptional({ type: [String], description: "CYCLE only: the SKUs to count" })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  skus?: string[];

  @ApiPropertyOptional({ description: "CYCLE only: count every product in this category" })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ default: true, description: "Hide expected quantities from counters while counting" })
  @IsOptional()
  @IsBoolean()
  blind?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class RecordCountDto {
  @ApiProperty({ minimum: 0, description: "Units physically found; a repeat entry replaces the earlier one" })
  @IsInt()
  @Min(0)
  countedQty!: number;
}

export const UNCOUNTED_HANDLING = ["reject", "skip", "zero"] as const;
export type UncountedHandling = (typeof UNCOUNTED_HANDLING)[number];

export class SubmitStockCountDto {
  @ApiPropertyOptional({
    enum: UNCOUNTED_HANDLING,
    default: "reject",
    description: "Lines nobody counted: refuse to submit (default), leave them out, or record them as 0 found",
  })
  @IsOptional()
  @IsIn(UNCOUNTED_HANDLING)
  uncounted?: UncountedHandling;
}

/** Newest first. `q` matches the count number. */
export class ListStockCountsQuery extends ListQueryDto {
  @ApiPropertyOptional({ enum: StockCountStatus })
  @IsOptional()
  @IsEnum(StockCountStatus)
  status?: StockCountStatus;

  @ApiPropertyOptional({ example: "WH-MAIN" })
  @IsOptional()
  @IsString()
  locationCode?: string;
}

export class CountSuggestionsQuery {
  @ApiProperty({ example: "WH-MAIN" })
  @IsString()
  locationCode!: string;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  limit?: number;
}
