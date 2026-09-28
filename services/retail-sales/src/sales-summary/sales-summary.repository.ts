import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class SalesSummaryRepository {
  constructor(private readonly prisma: PrismaService) {}

  findSales(storeId: string, from: Date, to: Date) {
    return this.prisma.transaction.findMany({
      where: { storeId, createdAt: { gte: from, lt: to } },
      select: {
        createdAt: true,
        totalAmount: true,
        lines: { select: { sku: true, productName: true, quantitySold: true, lineTotal: true } },
        payments: { select: { method: true, amount: true } },
      },
    });
  }

  findReturns(storeId: string, from: Date, to: Date) {
    return this.prisma.returnTransaction.findMany({
      where: { storeId, createdAt: { gte: from, lt: to } },
      select: { createdAt: true, refundAmount: true },
    });
  }
}
