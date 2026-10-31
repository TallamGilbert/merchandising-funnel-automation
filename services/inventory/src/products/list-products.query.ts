import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { ListQueryDto } from "@mms/shared";

/** By name. `q` matches the SKU or name. */
export class ListProductsQuery extends ListQueryDto {
  @ApiPropertyOptional({ example: "Sofas", description: "Exact category (case-insensitive)" })
  @IsOptional()
  @IsString()
  category?: string;
}
