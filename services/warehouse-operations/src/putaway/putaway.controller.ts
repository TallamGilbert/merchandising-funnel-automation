import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AuthUser, CurrentUser, Exportable, Role, Roles } from "@mms/shared";
import { Bin, PutawayTask } from "../generated/prisma";
import { AssignBinDto } from "./dto/assign-bin.dto";
import { CompletePutawayDto } from "./dto/complete-putaway.dto";
import { ListPutawayTasksQuery } from "./list-putaway-tasks.query";
import { PutawayService } from "./putaway.service";

@ApiTags("putaway-tasks")
@Controller()
export class PutawayController {
  constructor(private readonly putaway: PutawayService) {}

  @Get("putaway-tasks")
  @Exportable<PutawayTask & { bin: Bin | null }>("putaway-tasks", [
    { header: "SKU", value: (t) => t.sku },
    { header: "Product", value: (t) => t.productName },
    { header: "Quantity", value: (t) => t.quantity },
    { header: "GRN number", value: (t) => t.goodsReceivedNoteNumber },
    { header: "PO number", value: (t) => t.poNumber },
    { header: "Location", value: (t) => t.locationCode },
    { header: "Bin", value: (t) => t.bin?.code },
    { header: "Status", value: (t) => t.status },
    { header: "Completed by", value: (t) => t.completedById },
    { header: "Completed", value: (t) => t.completedAt },
    { header: "Created", value: (t) => t.createdAt },
  ])
  list(@Query() query: ListPutawayTasksQuery) {
    return this.putaway.list(query);
  }

  @Get("putaway-tasks/:id")
  findOne(@Param("id") id: string) {
    return this.putaway.findOne(id);
  }

  @Post("putaway-tasks/:id/assign")
  @Roles(Role.OWNER, Role.MANAGER, Role.WAREHOUSE_STAFF)
  assign(@Param("id") id: string, @Body() dto: AssignBinDto) {
    return this.putaway.assign(id, dto);
  }

  @Post("putaway-tasks/:id/complete")
  @Roles(Role.OWNER, Role.MANAGER, Role.WAREHOUSE_STAFF)
  complete(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: CompletePutawayDto) {
    return this.putaway.complete(id, { ...dto, completedById: user.id });
  }
}
