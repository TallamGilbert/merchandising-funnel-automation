import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsInt, IsOptional, IsString, Min } from "class-validator";
import { GrnCondition } from "../../generated/prisma";

export class RecordScanDto {
  @ApiProperty()
  @IsString()
  sku!: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiProperty({ enum: GrnCondition })
  @IsEnum(GrnCondition)
  condition!: GrnCondition;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
