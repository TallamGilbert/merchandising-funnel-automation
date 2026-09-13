import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsString } from "class-validator";

export enum ApproverRole {
  MANAGER = "MANAGER",
  OWNER = "OWNER",
}

export class ApprovePurchaseOrderDto {
  @ApiProperty()
  @IsString()
  approvedById!: string;

  @ApiProperty({ enum: ApproverRole })
  @IsEnum(ApproverRole)
  approverRole!: ApproverRole;
}
