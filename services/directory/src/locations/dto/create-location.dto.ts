import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsString, Matches } from "class-validator";
import { LocationType } from "../../generated/prisma";

export class CreateLocationDto {
  @ApiProperty({ example: "STORE-3", description: "Uppercase code used by every other service" })
  @IsString()
  @Matches(/^[A-Z0-9-]+$/, { message: "code must be uppercase letters, digits and dashes" })
  code!: string;

  @ApiProperty({ example: "Karen Showroom" })
  @IsString()
  name!: string;

  @ApiProperty({ enum: LocationType })
  @IsEnum(LocationType)
  type!: LocationType;
}
