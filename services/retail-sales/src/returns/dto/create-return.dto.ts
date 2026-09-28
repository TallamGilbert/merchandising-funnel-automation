import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsInt, IsString, Min, ValidateNested } from "class-validator";

export class ReturnLineDto {
  @ApiProperty()
  @IsString()
  transactionLineId!: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  quantityReturned!: number;
}

export class CreateReturnDto {
  @ApiProperty()
  @IsString()
  originalTransactionId!: string;

  @ApiProperty({ example: "STORE-1" })
  @IsString()
  storeId!: string;

  @ApiProperty({ example: "REG-1" })
  @IsString()
  registerId!: string;

  @ApiProperty({ type: [ReturnLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReturnLineDto)
  lines!: ReturnLineDto[];
}
