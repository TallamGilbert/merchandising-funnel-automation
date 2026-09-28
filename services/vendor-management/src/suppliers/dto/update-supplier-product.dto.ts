import { ApiPropertyOptional } from "@nestjs/swagger";
import { SUPPORTED_CURRENCY_CODES } from "@mms/shared";
import { IsIn, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class UpdateSupplierProductDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  productName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number;

  @ApiPropertyOptional({ enum: SUPPORTED_CURRENCY_CODES })
  @IsOptional()
  @IsIn(SUPPORTED_CURRENCY_CODES, { message: `currency must be one of ${SUPPORTED_CURRENCY_CODES.join(", ")}` })
  currency?: string;
}
