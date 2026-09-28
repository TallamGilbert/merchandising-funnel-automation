import { ApiProperty } from "@nestjs/swagger";
import { SUPPORTED_CURRENCY_CODES } from "@mms/shared";
import { IsIn, IsNumber, IsString, Min } from "class-validator";

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

  @ApiProperty({ enum: SUPPORTED_CURRENCY_CODES, default: "KES" })
  @IsIn(SUPPORTED_CURRENCY_CODES, { message: `currency must be one of ${SUPPORTED_CURRENCY_CODES.join(", ")}` })
  currency!: string;
}
