import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsNumber, IsOptional, IsString, Min } from "class-validator";

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currency?: string;
}
