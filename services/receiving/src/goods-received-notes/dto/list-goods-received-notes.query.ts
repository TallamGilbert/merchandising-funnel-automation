import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";
import { DateRangeQueryDto } from "@mms/shared";
import { GoodsReceivedNoteStatus } from "../../generated/prisma";

/** `q` matches the GRN or PO number; from/to filter on the day the GRN was opened. */
export class ListGoodsReceivedNotesQuery extends DateRangeQueryDto {
  @ApiPropertyOptional({ enum: GoodsReceivedNoteStatus })
  @IsOptional()
  @IsEnum(GoodsReceivedNoteStatus)
  status?: GoodsReceivedNoteStatus;
}
