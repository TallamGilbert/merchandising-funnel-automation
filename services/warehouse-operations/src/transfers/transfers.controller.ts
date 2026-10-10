import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AuthUser, CurrentUser, Role, Roles } from "@mms/shared";
import { TransferStatus } from "../generated/prisma";
import { CompletePickDto } from "./dto/complete-pick.dto";
import { CreateTransferDto } from "./dto/create-transfer.dto";
import { TransfersService } from "./transfers.service";

@ApiTags("transfers")
@Controller()
export class TransfersController {
  constructor(private readonly transfers: TransfersService) {}

  @Get("transfers")
  list(@Query("status") status?: TransferStatus) {
    return this.transfers.list(status);
  }

  @Post("transfers")
  @Roles(Role.OWNER, Role.MANAGER)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTransferDto) {
    return this.transfers.create({ ...dto, requestedById: user.id });
  }

  @Get("transfers/:id")
  findOne(@Param("id") id: string) {
    return this.transfers.findOne(id);
  }

  @Post("pick-tasks/:id/complete")
  @Roles(Role.OWNER, Role.MANAGER, Role.WAREHOUSE_STAFF)
  completePick(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: CompletePickDto) {
    return this.transfers.completePick(id, { ...dto, pickedById: user.id });
  }
}
