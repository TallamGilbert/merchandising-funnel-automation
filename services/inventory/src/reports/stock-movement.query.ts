import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class StockMovementQuery {
  @ApiPropertyOptional({ example: "STORE-1", description: "One location; omit for all" })
  @IsOptional()
  @IsString()
  locationCode?: string;

  @ApiPropertyOptional({ example: "Sofas", description: "Exact category, case-insensitive" })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ default: 90, minimum: 7, maximum: 365, description: "Sales window in days" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(7)
  @Max(365)
  days?: number;

  @ApiPropertyOptional({ default: 90, minimum: 1, description: "More days of cover than this is SLOW" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  slowAfterDays?: number;

  @ApiPropertyOptional({ enum: ["DEAD", "SLOW", "OK"] })
  @IsOptional()
  @IsIn(["DEAD", "SLOW", "OK"])
  status?: "DEAD" | "SLOW" | "OK";

  @ApiPropertyOptional({ enum: ["csv", "xlsx"] })
  @IsOptional()
  @IsIn(["csv", "xlsx"])
  format?: string;
}
