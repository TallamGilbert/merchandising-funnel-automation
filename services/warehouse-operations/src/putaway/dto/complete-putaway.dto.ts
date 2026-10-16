import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class CompletePutawayDto {
  @ApiProperty({ description: "Bin code the worker scanned at the shelf" })
  @IsString()
  scannedBinCode!: string;
}
