import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsInt,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";

export class CreatePurchaseOrderLineDto {
  @ApiProperty()
  @IsString()
  sku!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  quantityOrdered!: number;
}

export class CreatePurchaseOrderDto {
  @ApiProperty({ description: "Supplier id from Vendor Management" })
  @IsString()
  supplierId!: string;

  @ApiProperty({ description: "User id of the buyer creating this PO" })
  @IsString()
  requestedById!: string;

  @ApiProperty({ type: [CreatePurchaseOrderLineDto] })
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderLineDto)
  @ArrayMinSize(1)
  lines!: CreatePurchaseOrderLineDto[];
}
