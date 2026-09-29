import type { SalesSummary } from "./services";

export interface StoreSales {
  storeId: string;
  sales: number;
  returns: number;
  transactions: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Folds each store's sales summary into one business-wide view. */
export function combineSales(summaries: SalesSummary[]) {
  const daily = new Map<string, { date: string; sales: number; returns: number; transactions: number }>();
  const payments = new Map<string, number>();
  const products = new Map<string, { sku: string; productName: string; quantity: number; revenue: number }>();
  const stores: StoreSales[] = [];

  for (const s of summaries) {
    const store: StoreSales = { storeId: s.storeId, sales: 0, returns: 0, transactions: 0 };
    for (const d of s.daily) {
      const day = daily.get(d.date) ?? { date: d.date, sales: 0, returns: 0, transactions: 0 };
      day.sales += d.sales;
      day.returns += d.returns;
      day.transactions += d.transactions;
      daily.set(d.date, day);
      store.sales += d.sales;
      store.returns += d.returns;
      store.transactions += d.transactions;
    }
    stores.push({ ...store, sales: round2(store.sales), returns: round2(store.returns) });
    for (const p of s.paymentMix) payments.set(p.method, (payments.get(p.method) ?? 0) + p.amount);
    for (const p of s.topProducts) {
      const row = products.get(p.sku) ?? { sku: p.sku, productName: p.productName, quantity: 0, revenue: 0 };
      row.quantity += p.quantity;
      row.revenue += p.revenue;
      products.set(p.sku, row);
    }
  }

  const days = [...daily.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({ ...d, sales: round2(d.sales), returns: round2(d.returns) }));
  const sales = round2(stores.reduce((s, x) => s + x.sales, 0));
  const returns = round2(stores.reduce((s, x) => s + x.returns, 0));
  const transactions = stores.reduce((s, x) => s + x.transactions, 0);

  return {
    daily: days,
    stores: stores.sort((a, b) => b.sales - a.sales),
    paymentMix: [...payments.entries()].map(([method, amount]) => ({ method, amount: round2(amount) })).sort((a, b) => b.amount - a.amount),
    topProducts: [...products.values()].map((p) => ({ ...p, revenue: round2(p.revenue) })).sort((a, b) => b.revenue - a.revenue).slice(0, 8),
    sales,
    returns,
    transactions,
    averageSale: transactions ? round2(sales / transactions) : 0,
  };
}

export const PAYMENT_LABEL: Record<string, string> = { CASH: "Cash", CARD: "Card", GIFT_CARD: "Gift card" };

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
