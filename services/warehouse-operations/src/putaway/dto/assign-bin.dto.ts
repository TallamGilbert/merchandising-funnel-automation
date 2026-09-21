import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class AssignBinDto {
  @ApiPropertyOptional({ description: "Omit to run automatic bin selection" })
  @IsOptional()
  @IsString()
  binCode?: string;
}
