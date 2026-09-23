import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateBinDto {
  @ApiProperty({ example: "A-01-03" })
  @IsString()
  code!: string;

  @ApiProperty({ example: "WH-MAIN" })
  @IsString()
  locationCode!: string;

  @ApiProperty({ example: "FAST-PICK" })
  @IsString()
  zone!: string;

  @ApiPropertyOptional({ default: 100, description: "Lower = closer to dispatch" })
  @IsOptional()
  @IsInt()
  pickPriority?: number;

  @ApiProperty({ minimum: 0 })
  @IsNumber()
  @Min(0)
  capacityVolumeCm3!: number;

  @ApiProperty({ minimum: 0 })
  @IsNumber()
  @Min(0)
  maxWeightKg!: number;
}
