import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiQuery, ApiTags } from "@nestjs/swagger";
import { Exportable, Role, Roles } from "@mms/shared";
import { PayableBill } from "../generated/prisma";
import { PayBillDto } from "./dto/pay-bill.dto";
import { ListPayablesQuery } from "./list-payables.query";
import { PayablesService } from "./payables.service";

@ApiTags("payables")
@Roles(Role.OWNER, Role.MANAGER, Role.ACCOUNTANT)
@Controller("payables")
export class PayablesController {
  constructor(private readonly payables: PayablesService) {}

  @Get()
  @Exportable<PayableBill & { daysOverdue: number; agingBucket: string | null }>("payables", [
    { header: "Supplier", value: (b) => b.supplierName },
    { header: "PO number", value: (b) => b.poNumber },
    { header: "GRN number", value: (b) => b.goodsReceivedNoteNumber },
    { header: "Amount", value: (b) => Number(b.amount) },
    { header: "Currency", value: (b) => b.currency },
    { header: "Bill date", value: (b) => b.billDate },
    { header: "Due date", value: (b) => b.dueDate },
    { header: "Status", value: (b) => b.status },
    { header: "Days overdue", value: (b) => b.daysOverdue },
    { header: "Paid at", value: (b) => b.paidAt },
    { header: "Payment reference", value: (b) => b.paymentReference },
  ])
  list(@Query() query: ListPayablesQuery) {
    return this.payables.list(query);
  }

  @Get("aging")
  @ApiQuery({ name: "asOf", required: false, description: "YYYY-MM-DD; default today" })
  aging(@Query("asOf") asOf?: string) {
    return this.payables.aging(asOf);
  }

  @Post(":id/pay")
  @Roles(Role.OWNER, Role.ACCOUNTANT)
  pay(@Param("id") id: string, @Body() dto: PayBillDto) {
    return this.payables.pay(id, dto.paymentReference, dto.paidOn);
  }
}
