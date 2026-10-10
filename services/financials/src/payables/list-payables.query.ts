import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { ListQueryDto } from "@mms/shared";
import { BillStatus } from "../generated/prisma";

/** Open bills first, soonest due first. `q` matches the supplier, PO or GRN number. */
export class ListPayablesQuery extends ListQueryDto {
  @ApiPropertyOptional({ enum: BillStatus })
  @IsOptional()
  @IsEnum(BillStatus)
  status?: BillStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  supplierId?: string;
}
