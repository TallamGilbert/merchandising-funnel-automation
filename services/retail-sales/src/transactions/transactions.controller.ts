import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Exportable } from "@mms/shared";
import { Prisma } from "../generated/prisma";
import { ListTransactionsQuery } from "./list-transactions.query";
import { TransactionsService } from "./transactions.service";

type TransactionRow = Prisma.TransactionGetPayload<{ include: { payments: true } }>;

@ApiTags("transactions")
@Controller("transactions")
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Get()
  @Exportable<TransactionRow>("transactions", [
    { header: "Transaction", value: (t) => t.transactionNumber },
    { header: "Date", value: (t) => t.createdAt },
    { header: "Store", value: (t) => t.storeId },
    { header: "Register", value: (t) => t.registerId },
    { header: "Cashier", value: (t) => t.cashierId },
    { header: "Status", value: (t) => t.status },
    { header: "Subtotal (KES)", value: (t) => Number(t.subtotalAmount) },
    { header: "Discount (KES)", value: (t) => Number(t.discountAmount) },
    { header: "VAT (KES)", value: (t) => Number(t.taxAmount) },
    { header: "Total (KES)", value: (t) => Number(t.totalAmount) },
    { header: "Paid by", value: (t) => t.payments.map((p) => p.method).join(" + ") },
  ])
  list(@Query() query: ListTransactionsQuery) {
    return this.transactions.list(query);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.transactions.findOne(id);
  }
}
