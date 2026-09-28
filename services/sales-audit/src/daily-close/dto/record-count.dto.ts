import { ApiProperty } from "@nestjs/swagger";
import { IsNumber, IsString, Min } from "class-validator";

export class RecordCountDto {
  @ApiProperty({ example: "2026-09-24" })
  @IsString()
  businessDate!: string;

  @ApiProperty({ description: "Manager's physical count across all tills (FR-7.2)" })
  @IsNumber()
  @Min(0)
  actualCountedTotal!: number;
}
