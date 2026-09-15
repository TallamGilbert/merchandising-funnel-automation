import { ApiProperty } from "@nestjs/swagger";
import { IsNumber, IsString, Min } from "class-validator";

export class CreateSupplierProductDto {
  @ApiProperty({ description: "Product SKU, owned by the Inventory service" })
  @IsString()
  sku!: string;

  @ApiProperty()
  @IsString()
  productName!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  unitCost!: number;

  @ApiProperty({ default: "KES" })
  @IsString()
  currency!: string;
}
