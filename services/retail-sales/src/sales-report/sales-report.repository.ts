import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ReturnRow, SaleRow } from "./sales-report";

@Injectable()
export class SalesReportRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findSales(from: Date, to: Date, storeId?: string): Promise<SaleRow[]> {
    const rows = await this.prisma.transaction.findMany({
      where: { storeId, createdAt: { gte: from, lt: to } },
      select: {
        id: true,
        storeId: true,
        cashierId: true,
        createdAt: true,
        discountAmount: true,
        taxAmount: true,
        totalAmount: true,
        lines: {
          select: { sku: true, productName: true, quantitySold: true, discountAmount: true, taxAmount: true, lineTotal: true },
        },
      },
    });
    return rows.map((t) => ({
      ...t,
      discountAmount: Number(t.discountAmount),
      taxAmount: Number(t.taxAmount),
      totalAmount: Number(t.totalAmount),
      lines: t.lines.map((l) => ({
        ...l,
        discountAmount: Number(l.discountAmount),
        taxAmount: Number(l.taxAmount),
        lineTotal: Number(l.lineTotal),
      })),
    }));
  }

  async findReturns(from: Date, to: Date, storeId?: string): Promise<ReturnRow[]> {
    const rows = await this.prisma.returnTransaction.findMany({
      where: { storeId, createdAt: { gte: from, lt: to } },
      select: {
        createdAt: true,
        storeId: true,
        refundAmount: true,
        originalTransaction: { select: { cashierId: true } },
        lines: { select: { sku: true, productName: true, quantityReturned: true, refundAmount: true } },
      },
    });
    return rows.map((r) => ({
      createdAt: r.createdAt,
      storeId: r.storeId,
      refundAmount: Number(r.refundAmount),
      originalCashierId: r.originalTransaction.cashierId,
      lines: r.lines.map((l) => ({ ...l, refundAmount: Number(l.refundAmount) })),
    }));
  }
}
