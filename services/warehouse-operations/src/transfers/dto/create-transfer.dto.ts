import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsString, Min } from "class-validator";

export class CreateTransferDto {
  @ApiProperty()
  @IsString()
  sku!: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiProperty({ example: "WH-MAIN" })
  @IsString()
  fromLocationCode!: string;

  @ApiProperty({ example: "STORE-1" })
  @IsString()
  toLocationCode!: string;

  @ApiProperty({ description: "User id of the supervisor requesting the transfer" })
  @IsString()
  requestedById!: string;
}
