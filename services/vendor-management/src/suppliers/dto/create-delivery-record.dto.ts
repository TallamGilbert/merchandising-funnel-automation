import { ApiProperty } from "@nestjs/swagger";
import { IsDateString, IsString } from "class-validator";

export class CreateSupplierDeliveryRecordDto {
  @ApiProperty({ description: "Procurement's PO number for this delivery" })
  @IsString()
  poReference!: string;

  @ApiProperty()
  @IsDateString()
  expectedDate!: string;

  @ApiProperty()
  @IsDateString()
  actualDeliveryDate!: string;
}
