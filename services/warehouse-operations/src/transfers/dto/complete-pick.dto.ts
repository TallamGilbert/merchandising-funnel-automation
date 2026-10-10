import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class CompletePickDto {
  @ApiProperty({ description: "Bin code the picker scanned at the shelf" })
  @IsString()
  scannedBinCode!: string;
}
