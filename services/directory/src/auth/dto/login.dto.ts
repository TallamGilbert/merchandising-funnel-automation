import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";
import { MIN_PASSWORD_LENGTH } from "../password";

export class LoginDto {
  @ApiProperty({ example: "mgr-sam", description: "Staff id" })
  @IsString()
  @MaxLength(100)
  staffId!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  password!: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  currentPassword!: string;

  @ApiProperty({ minLength: MIN_PASSWORD_LENGTH })
  @IsString()
  @MinLength(MIN_PASSWORD_LENGTH, { message: `Use at least ${MIN_PASSWORD_LENGTH} characters` })
  @MaxLength(200)
  newPassword!: string;
}
