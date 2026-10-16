import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";
import { DateRangeQueryDto } from "@mms/shared";
import { PurchaseOrderStatus } from "../../generated/prisma";

/** `q` matches the PO number or supplier name; from/to filter on the creation day. */
export class ListPurchaseOrdersQuery extends DateRangeQueryDto {
  @ApiPropertyOptional({ enum: PurchaseOrderStatus })
  @IsOptional()
  @IsEnum(PurchaseOrderStatus)
  status?: PurchaseOrderStatus;
}
