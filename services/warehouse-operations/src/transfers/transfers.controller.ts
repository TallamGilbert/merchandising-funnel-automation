import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AuthUser, CurrentUser, Exportable, Role, Roles } from "@mms/shared";
import { Transfer } from "../generated/prisma";
import { CompletePickDto } from "./dto/complete-pick.dto";
import { CreateTransferDto } from "./dto/create-transfer.dto";
import { ListTransfersQuery } from "./list-transfers.query";
import { TransfersService } from "./transfers.service";

@ApiTags("transfers")
@Controller()
export class TransfersController {
  constructor(private readonly transfers: TransfersService) {}

  @Get("transfers")
  @Exportable<Transfer>("transfers", [
    { header: "Transfer", value: (t) => t.transferNumber },
    { header: "SKU", value: (t) => t.sku },
    { header: "Quantity", value: (t) => t.quantity },
    { header: "From", value: (t) => t.fromLocationCode },
    { header: "To", value: (t) => t.toLocationCode },
    { header: "Status", value: (t) => t.status },
    { header: "Requested by", value: (t) => t.requestedById },
    { header: "Raised", value: (t) => t.createdAt },
    { header: "Completed", value: (t) => t.completedAt },
  ])
  list(@Query() query: ListTransfersQuery) {
    return this.transfers.list(query);
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
