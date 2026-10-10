import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";
import { ListQueryDto } from "@mms/shared";
import { ExpectedDeliveryStatus } from "../generated/prisma";

/** `q` matches the PO number or supplier name. */
export class ListExpectedDeliveriesQuery extends ListQueryDto {
  @ApiPropertyOptional({ enum: ExpectedDeliveryStatus })
  @IsOptional()
  @IsEnum(ExpectedDeliveryStatus)
  status?: ExpectedDeliveryStatus;
}
