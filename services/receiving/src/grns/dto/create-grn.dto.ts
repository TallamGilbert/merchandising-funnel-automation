import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class CreateGrnDto {
  @ApiProperty({ example: "PO-1001" })
  @IsString()
  poNumber!: string;

  @ApiProperty({
    description: "Location code of the dock the goods arrived at (matches Inventory's locationCode)",
    example: "WH-MAIN",
  })
  @IsString()
  receivedAtLocation!: string;

  @ApiProperty({ description: "User id of the dock worker" })
  @IsString()
  receivedById!: string;
}
