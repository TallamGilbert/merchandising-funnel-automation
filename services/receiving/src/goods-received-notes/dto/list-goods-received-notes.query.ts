import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { DateRangeQueryDto } from "@mms/shared";
import { GoodsReceivedNoteStatus } from "../../generated/prisma";

/** `q` matches the GRN or PO number; from/to filter on the day the GRN was opened; `locationCode` on where it is being received. */
export class ListGoodsReceivedNotesQuery extends DateRangeQueryDto {
  @ApiPropertyOptional({ enum: GoodsReceivedNoteStatus })
  @IsOptional()
  @IsEnum(GoodsReceivedNoteStatus)
  status?: GoodsReceivedNoteStatus;

  @ApiPropertyOptional({ example: "DOCK-1" })
  @IsOptional()
  @IsString()
  locationCode?: string;
}
