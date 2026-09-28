const RETAIL_SALES_URL = process.env.NEXT_PUBLIC_RETAIL_SALES_URL ?? "http://localhost:3006";

export interface SalesSummary {
  storeId: string;
  from: string;
  to: string;
  daily: { date: string; sales: number; returns: number; transactions: number }[];
  paymentMix: { method: "CASH" | "CARD" | "GIFT_CARD"; amount: number }[];
  topProducts: { sku: string; productName: string; quantity: number; revenue: number }[];
}

/** Retail Sales owns the transactions, so the charts read its summary directly. */
export async function getSalesSummary(storeId: string, from: string, to: string): Promise<SalesSummary> {
  const res = await fetch(
    `${RETAIL_SALES_URL}/stores/${encodeURIComponent(storeId)}/sales-summary?from=${from}&to=${to}`,
  );
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? res.statusText);
  }
  return res.json() as Promise<SalesSummary>;
}
