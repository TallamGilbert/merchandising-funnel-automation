import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { DateRangeQueryDto } from "@mms/shared";
import { TransactionStatus } from "../generated/prisma";

/** Newest first. `q` matches the transaction number; from/to filter on the sale day. */
export class ListTransactionsQuery extends DateRangeQueryDto {
  @ApiPropertyOptional({ example: "STORE-1" })
  @IsOptional()
  @IsString()
  storeId?: string;

  @ApiPropertyOptional({ example: "REG-1" })
  @IsOptional()
  @IsString()
  registerId?: string;

  @ApiPropertyOptional({ example: "cashier-amy" })
  @IsOptional()
  @IsString()
  cashierId?: string;

  @ApiPropertyOptional({ enum: TransactionStatus })
  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;
}
