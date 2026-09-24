import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ExpectedTotalService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * FR-7.1 cross-module call — Sales Audit's REST cross-check at close time
   * (D-9). Sums completed sales minus returns for one store on one business
   * date (UTC day boundaries — this is a source-of-record answer, not a
   * live register display).
   */
  async getExpectedTotal(storeId: string, businessDate: string) {
    const { start, end } = dayBounds(businessDate);

    const [sales, returns] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: { storeId, createdAt: { gte: start, lt: end } },
        _sum: { totalAmount: true },
      }),
      this.prisma.returnTransaction.aggregate({
        where: { storeId, createdAt: { gte: start, lt: end } },
        _sum: { refundAmount: true },
      }),
    ]);

    const salesTotal = Number(sales._sum.totalAmount ?? 0);
    const returnsTotal = Number(returns._sum.refundAmount ?? 0);

    return { storeId, businessDate, expectedTotal: round2(salesTotal - returnsTotal) };
  }
}

function dayBounds(businessDate: string): { start: Date; end: Date } {
  const start = new Date(`${businessDate}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
