import { Injectable } from "@nestjs/common";
import { ReturnsRepository } from "../returns/returns.repository";
import { TransactionsRepository } from "../transactions/transactions.repository";

@Injectable()
export class ExpectedTotalService {
  constructor(
    private readonly transactions: TransactionsRepository,
    private readonly returns: ReturnsRepository,
  ) {}

  /**
   * FR-7.1 cross-module call — Sales Audit's REST cross-check at close time
   * (D-9). Sums completed sales minus returns for one store on one business
   * date (UTC day boundaries — this is a source-of-record answer, not a
   * live register display).
   */
  async getExpectedTotal(storeId: string, businessDate: string) {
    const { start, end } = dayBounds(businessDate);

    const [salesTotal, returnsTotal] = await Promise.all([
      this.transactions.sumTotalForStore(storeId, start, end),
      this.returns.sumRefundsForStore(storeId, start, end),
    ]);

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
