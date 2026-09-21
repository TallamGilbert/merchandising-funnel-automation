import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { PurchaseOrderStatus } from "../generated/prisma";
import { ApprovePurchaseOrderDto } from "./dto/approve-purchase-order.dto";
import { CreatePurchaseOrderDto } from "./dto/create-purchase-order.dto";
import { PurchaseOrdersService } from "./purchase-orders.service";

@ApiTags("purchase-orders")
@Controller()
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrders: PurchaseOrdersService) {}

  @Get("purchase-orders")
  list(@Query("status") status?: PurchaseOrderStatus) {
    return this.purchaseOrders.list(status);
  }

  @Post("purchase-orders")
  create(@Body() dto: CreatePurchaseOrderDto) {
    return this.purchaseOrders.create(dto);
  }

  @Get("purchase-orders/lookup/:poNumber")
  findByPoNumber(@Param("poNumber") poNumber: string) {
    return this.purchaseOrders.findByPoNumber(poNumber);
  }

  @Get("purchase-orders/:id")
  findOne(@Param("id") id: string) {
    return this.purchaseOrders.findOne(id);
  }

  @Post("purchase-orders/:id/submit")
  submit(@Param("id") id: string) {
    return this.purchaseOrders.submit(id);
  }

  @Post("purchase-orders/:id/approve")
  approve(@Param("id") id: string, @Body() dto: ApprovePurchaseOrderDto) {
    return this.purchaseOrders.approve(id, dto);
  }

  @Post("purchase-orders/:id/mark-sent")
  markSent(@Param("id") id: string) {
    return this.purchaseOrders.markSent(id);
  }
}
