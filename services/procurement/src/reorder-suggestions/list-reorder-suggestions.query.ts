import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";
import { ListQueryDto } from "@mms/shared";
import { ReorderSuggestionStatus } from "../generated/prisma";

/** `q` matches the SKU. */
export class ListReorderSuggestionsQuery extends ListQueryDto {
  @ApiPropertyOptional({ enum: ReorderSuggestionStatus })
  @IsOptional()
  @IsEnum(ReorderSuggestionStatus)
  status?: ReorderSuggestionStatus;
}
