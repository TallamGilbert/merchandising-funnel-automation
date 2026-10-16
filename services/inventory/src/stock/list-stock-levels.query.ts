import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { ListQueryDto } from "@mms/shared";

/** `q` matches the SKU or product name. */
export class ListStockLevelsQuery extends ListQueryDto {
  @ApiPropertyOptional({ example: "WH-MAIN" })
  @IsOptional()
  @IsString()
  locationCode?: string;
}
