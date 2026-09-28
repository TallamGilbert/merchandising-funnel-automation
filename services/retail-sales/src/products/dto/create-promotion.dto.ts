import { ApiProperty } from "@nestjs/swagger";
import { IsDateString, IsNumber, Max, Min } from "class-validator";

export class CreatePromotionDto {
  @ApiProperty({ description: "Percentage discount off the subtotal", example: 15 })
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPct!: number;

  @ApiProperty({ example: "2026-09-01T00:00:00.000Z" })
  @IsDateString()
  startsAt!: string;

  @ApiProperty({ example: "2026-09-30T23:59:59.000Z" })
  @IsDateString()
  endsAt!: string;
}
