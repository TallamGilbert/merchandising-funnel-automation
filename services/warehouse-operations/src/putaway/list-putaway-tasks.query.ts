import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { ListQueryDto } from "@mms/shared";
import { PutawayTaskStatus } from "../generated/prisma";

/** Oldest first (the queue order). `q` matches the SKU, product name, GRN or PO number. */
export class ListPutawayTasksQuery extends ListQueryDto {
  @ApiPropertyOptional({ enum: PutawayTaskStatus })
  @IsOptional()
  @IsEnum(PutawayTaskStatus)
  status?: PutawayTaskStatus;

  @ApiPropertyOptional({ example: "WH-MAIN" })
  @IsOptional()
  @IsString()
  locationCode?: string;
}
