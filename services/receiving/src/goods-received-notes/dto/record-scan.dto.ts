import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsInt, IsOptional, IsString, Min } from "class-validator";
import { GoodsReceivedNoteCondition } from "../../generated/prisma";

export class RecordScanDto {
  @ApiProperty()
  @IsString()
  sku!: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiProperty({ enum: GoodsReceivedNoteCondition })
  @IsEnum(GoodsReceivedNoteCondition)
  condition!: GoodsReceivedNoteCondition;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
