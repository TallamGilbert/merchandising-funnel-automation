import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class CloseDailyDto {
  @ApiProperty({ example: "2026-09-24" })
  @IsString()
  businessDate!: string;

  @ApiProperty({ description: "User id of the manager closing the store" })
  @IsString()
  closedByManagerId!: string;
}
