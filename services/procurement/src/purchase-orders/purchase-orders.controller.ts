import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AuthUser, CurrentUser, Exportable, Role, Roles } from "@mms/shared";
import { PurchaseOrder } from "../generated/prisma";
import { CreatePurchaseOrderDto } from "./dto/create-purchase-order.dto";
import { ListPurchaseOrdersQuery } from "./dto/list-purchase-orders.query";
import { PurchaseOrdersService } from "./purchase-orders.service";

@ApiTags("purchase-orders")
@Controller()
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrders: PurchaseOrdersService) {}

  @Get("purchase-orders")
  @Exportable<PurchaseOrder>("purchase-orders", [
    { header: "PO number", value: (po) => po.poNumber },
    { header: "Supplier", value: (po) => po.supplierName },
    { header: "Status", value: (po) => po.status },
    { header: "Currency", value: (po) => po.currency },
    { header: "Total", value: (po) => Number(po.totalAmount) },
    { header: "Requested by", value: (po) => po.requestedById },
    { header: "Approved by", value: (po) => po.approvedById },
    { header: "Approved at", value: (po) => po.approvedAt },
    { header: "Created", value: (po) => po.createdAt },
  ])
  list(@Query() query: ListPurchaseOrdersQuery) {
    return this.purchaseOrders.list(query);
  }

  @Post("purchase-orders")
  @Roles(Role.OWNER, Role.MANAGER, Role.BUYER)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePurchaseOrderDto) {
    return this.purchaseOrders.create(dto, user.id);
  }

  @Get("purchase-orders/lookup/:poNumber")
  findByPoNumber(@Param("poNumber") poNumber: string) {
    return this.purchaseOrders.findByPoNumber(poNumber);
  }

  @Get("purchase-orders/by-number/:poNumber")
  findAnyByPoNumber(@Param("poNumber") poNumber: string) {
    return this.purchaseOrders.findAnyByPoNumber(poNumber);
  }

  @Get("purchase-orders/:id")
  findOne(@Param("id") id: string) {
    return this.purchaseOrders.findOne(id);
  }

  @Post("purchase-orders/:id/submit")
  @Roles(Role.OWNER, Role.MANAGER, Role.BUYER)
  submit(@Param("id") id: string) {
    return this.purchaseOrders.submit(id);
  }

  @Post("purchase-orders/:id/approve")
  @Roles(Role.OWNER, Role.MANAGER)
  approve(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.purchaseOrders.approve(id, user);
  }

  @Post("purchase-orders/:id/mark-sent")
  @Roles(Role.OWNER, Role.MANAGER, Role.BUYER)
  markSent(@Param("id") id: string) {
    return this.purchaseOrders.markSent(id);
  }
}
