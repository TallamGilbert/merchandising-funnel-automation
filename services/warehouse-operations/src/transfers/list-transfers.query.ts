import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { DateRangeQueryDto } from "@mms/shared";
import { TransferStatus } from "../generated/prisma";

/**
 * Newest first. `q` matches the transfer number or SKU; from/to filter on the
 * day it was raised; `locationCode` matches either end of the transfer.
 */
export class ListTransfersQuery extends DateRangeQueryDto {
  @ApiPropertyOptional({ enum: TransferStatus })
  @IsOptional()
  @IsEnum(TransferStatus)
  status?: TransferStatus;

  @ApiPropertyOptional({ example: "STORE-1" })
  @IsOptional()
  @IsString()
  locationCode?: string;
}
