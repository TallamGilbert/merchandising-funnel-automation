import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class ExplainDiscrepancyDto {
  @ApiProperty({ example: "2026-09-24" })
  @IsString()
  businessDate!: string;

  @ApiProperty({ description: "Manager's explanation for the over/short (FR-7.4)" })
  @IsString()
  @MinLength(1)
  explanation!: string;
}
