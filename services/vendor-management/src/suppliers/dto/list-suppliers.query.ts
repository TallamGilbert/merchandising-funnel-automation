import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";
import { ListQueryDto } from "@mms/shared";
import { SupplierStatus } from "../../generated/prisma";

/** By name. `q` matches the name, contact name or email. */
export class ListSuppliersQuery extends ListQueryDto {
  @ApiPropertyOptional({ enum: SupplierStatus })
  @IsOptional()
  @IsEnum(SupplierStatus)
  status?: SupplierStatus;
}
