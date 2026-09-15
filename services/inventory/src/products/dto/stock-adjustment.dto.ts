import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsString } from "class-validator";

export class StockAdjustmentDto {
  @ApiProperty()
  @IsString()
  locationCode!: string;

  @ApiProperty({ description: "Positive increases On Hand, negative decreases it" })
  @IsInt()
  quantityDelta!: number;

  @ApiProperty()
  @IsString()
  reason!: string;
}
