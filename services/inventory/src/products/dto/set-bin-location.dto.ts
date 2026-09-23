import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsString, Min } from "class-validator";

export class SetBinLocationDto {
  @ApiProperty({ example: "WH-MAIN" })
  @IsString()
  locationCode!: string;

  @ApiProperty({
    minimum: 0,
    description: "Absolute number of units of this SKU in the bin — not a delta",
  })
  @IsInt()
  @Min(0)
  quantity!: number;
}
