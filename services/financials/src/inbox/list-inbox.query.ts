import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";
import { ListQueryDto } from "@mms/shared";
import { InboxStatus } from "../generated/prisma";

/** Newest first. `q` matches the event id or routing key. */
export class ListInboxQuery extends ListQueryDto {
  @ApiPropertyOptional({ enum: InboxStatus })
  @IsOptional()
  @IsEnum(InboxStatus)
  status?: InboxStatus;
}
