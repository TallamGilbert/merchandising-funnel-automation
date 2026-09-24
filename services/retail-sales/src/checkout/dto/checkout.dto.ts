import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";
import { PaymentMethodType } from "../../generated/prisma";

export class CheckoutLineDto {
  @ApiProperty({ example: "SKU-1" })
  @IsString()
  sku!: string;

  @ApiProperty({ minimum: 1, example: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CheckoutPaymentDto {
  @ApiProperty({ enum: PaymentMethodType })
  @IsEnum(PaymentMethodType)
  method!: PaymentMethodType;

  @ApiProperty({ minimum: 0 })
  @IsNumber()
  @Min(0)
  amount!: number;
}

export class CheckoutDto {
  @ApiProperty({ example: "STORE-1" })
  @IsString()
  storeId!: string;

  @ApiProperty({ example: "REG-1" })
  @IsString()
  registerId!: string;

  @ApiProperty({ example: "cashier-amy" })
  @IsString()
  cashierId!: string;

  @ApiProperty({
    description: "Inventory location code this register sells from (matches Inventory's locationCode)",
    example: "STORE-1",
  })
  @IsString()
  locationCode!: string;

  @ApiProperty({ type: [CheckoutLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CheckoutLineDto)
  lines!: CheckoutLineDto[];

  @ApiProperty({ type: [CheckoutPaymentDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CheckoutPaymentDto)
  payments!: CheckoutPaymentDto[];
}
