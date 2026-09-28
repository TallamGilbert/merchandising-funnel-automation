import { BadRequestException, Injectable } from "@nestjs/common";
import { SalesSummaryRepository } from "./sales-summary.repository";

const BUSINESS_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 92;
const TOP_PRODUCTS = 5;

export interface SalesSummary {
  storeId: string;
  from: string;
  to: string;
  daily: { date: string; sales: number; returns: number; transactions: number }[];
  paymentMix: { method: string; amount: number }[];
  topProducts: { sku: string; productName: string; quantity: number; revenue: number }[];
}

/**
 * Analytics for the Store Manager Dashboard: per-day sales and refunds,
 * payment-method mix and best sellers over an inclusive range of UTC
 * business dates (same day boundaries as the expected-total cross-check).
 */
@Injectable()
export class SalesSummaryService {
  constructor(private readonly summary: SalesSummaryRepository) {}

  async summarize(storeId: string, from: string, to: string): Promise<SalesSummary> {
    const days = dateRange(from, to);
    const start = new Date(`${from}T00:00:00.000Z`);
    const end = new Date(`${to}T00:00:00.000Z`);
    end.setUTCDate(end.getUTCDate() + 1);

    const [sales, returns] = await Promise.all([
      this.summary.findSales(storeId, start, end),
      this.summary.findReturns(storeId, start, end),
    ]);

    const daily = new Map(days.map((date) => [date, { date, sales: 0, returns: 0, transactions: 0 }]));
    const payments = new Map<string, number>();
    const products = new Map<string, { sku: string; productName: string; quantity: number; revenue: number }>();

    for (const sale of sales) {
      const day = daily.get(sale.createdAt.toISOString().slice(0, 10));
      if (day) {
        day.sales += Number(sale.totalAmount);
        day.transactions += 1;
      }
      for (const p of sale.payments) payments.set(p.method, (payments.get(p.method) ?? 0) + Number(p.amount));
      for (const line of sale.lines) {
        const product = products.get(line.sku) ?? { sku: line.sku, productName: line.productName, quantity: 0, revenue: 0 };
        product.quantity += line.quantitySold;
        product.revenue += Number(line.lineTotal);
        products.set(line.sku, product);
      }
    }
    for (const ret of returns) {
      const day = daily.get(ret.createdAt.toISOString().slice(0, 10));
      if (day) day.returns += Number(ret.refundAmount);
    }

    return {
      storeId,
      from,
      to,
      daily: [...daily.values()].map((d) => ({ ...d, sales: round2(d.sales), returns: round2(d.returns) })),
      paymentMix: [...payments.entries()]
        .map(([method, amount]) => ({ method, amount: round2(amount) }))
        .sort((a, b) => b.amount - a.amount),
      topProducts: [...products.values()]
        .map((p) => ({ ...p, revenue: round2(p.revenue) }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, TOP_PRODUCTS),
    };
  }
}

function dateRange(from: string, to: string): string[] {
  if (!BUSINESS_DATE.test(from) || !BUSINESS_DATE.test(to)) {
    throw new BadRequestException("from and to must be dates (YYYY-MM-DD)");
  }
  const cursor = new Date(`${from}T00:00:00.000Z`);
  const last = new Date(`${to}T00:00:00.000Z`);
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(last.getTime()) || cursor > last) {
    throw new BadRequestException("from must be on or before to");
  }
  const days: string[] = [];
  while (cursor <= last) {
    days.push(cursor.toISOString().slice(0, 10));
    if (days.length > MAX_DAYS) throw new BadRequestException(`A range can cover at most ${MAX_DAYS} days`);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
