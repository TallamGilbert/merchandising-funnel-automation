import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, Matches } from "class-validator";
import { StaffRole } from "../../generated/prisma";

export class CreateStaffDto {
  @ApiProperty({ example: "cashier-amy", description: "Identifier other services record against this person" })
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: "id must be lowercase letters, digits and dashes" })
  id!: string;

  @ApiProperty({ example: "Amy Wanjiru" })
  @IsString()
  name!: string;

  @ApiProperty({ enum: StaffRole })
  @IsEnum(StaffRole)
  role!: StaffRole;

  @ApiPropertyOptional({ example: "STORE-1", description: "Home store/warehouse" })
  @IsOptional()
  @IsString()
  locationCode?: string;
}
