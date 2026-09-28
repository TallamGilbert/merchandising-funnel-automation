import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateProductDto {
  @ApiProperty({ example: "SKU-1" })
  @IsString()
  sku!: string;

  @ApiProperty({ example: "Oak Chair" })
  @IsString()
  name!: string;

  @ApiProperty({ description: "Retail selling price per unit", example: 149.99 })
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @ApiPropertyOptional({ description: "Sales tax rate, as a percentage", example: 7.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  taxRatePct?: number;
}
