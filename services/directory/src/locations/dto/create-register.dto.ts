import { ApiProperty } from "@nestjs/swagger";
import { IsString, Matches } from "class-validator";

export class CreateRegisterDto {
  @ApiProperty({ example: "REG-3", description: "Unique within its store" })
  @IsString()
  @Matches(/^[A-Z0-9-]+$/, { message: "code must be uppercase letters, digits and dashes" })
  code!: string;

  @ApiProperty({ example: "Till 3 (entrance)" })
  @IsString()
  name!: string;
}
