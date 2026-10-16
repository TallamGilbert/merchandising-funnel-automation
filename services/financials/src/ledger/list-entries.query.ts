import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { DateRangeQueryDto } from "@mms/shared";
import { EntrySource } from "../generated/prisma";

/** Newest first. `q` matches the source reference or description; from/to filter on when it happened. */
export class ListEntriesQuery extends DateRangeQueryDto {
  @ApiPropertyOptional({ description: "Only entries with a line on this account", example: "1200" })
  @IsOptional()
  @IsString()
  accountCode?: string;

  @ApiPropertyOptional({ enum: EntrySource })
  @IsOptional()
  @IsEnum(EntrySource)
  source?: EntrySource;
}
