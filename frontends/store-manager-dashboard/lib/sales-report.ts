import { apiFetch, withQuery } from "@mms/ui";

const RETAIL_SALES_URL = process.env.NEXT_PUBLIC_RETAIL_SALES_URL ?? "http://localhost:3006";

export type SalesGrouping = "cashier" | "hour" | "day" | "sku" | "store";

export interface SalesReportRow {
  key: string;
  label: string;
  transactions: number;
  units: number;
  /** After discounts, VAT included. */
  sales: number;
  discounts: number;
  vat: number;
  returns: number;
  unitsReturned: number;
  net: number;
}

export interface SalesReportParams {
  from: string;
  to: string;
  storeId?: string;
  groupBy: SalesGrouping;
}

export const salesReportUrl = `${RETAIL_SALES_URL}/reports/sales`;

/** D-20 — Retail Sales owns the transactions, so the report reads it directly. */
export async function getSalesReport(params: SalesReportParams): Promise<SalesReportRow[]> {
  const res = await apiFetch(withQuery(salesReportUrl, { ...params }));
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(Array.isArray(body?.message) ? body.message.join(", ") : (body?.message ?? res.statusText));
  }
  return res.json() as Promise<SalesReportRow[]>;
}

/** Adds up rows — e.g. products into their category. Transactions don't add across products, so they're left out. */
export function rollUp(rows: SalesReportRow[], keyOf: (row: SalesReportRow) => string): SalesReportRow[] {
  const groups = new Map<string, SalesReportRow>();
  for (const row of rows) {
    const key = keyOf(row);
    const g = groups.get(key) ?? {
      key,
      label: key,
      transactions: 0,
      units: 0,
      sales: 0,
      discounts: 0,
      vat: 0,
      returns: 0,
      unitsReturned: 0,
      net: 0,
    };
    g.units += row.units;
    g.sales += row.sales;
    g.discounts += row.discounts;
    g.vat += row.vat;
    g.returns += row.returns;
    g.unitsReturned += row.unitsReturned;
    g.net += row.net;
    groups.set(key, g);
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  return [...groups.values()]
    .map((g) => ({ ...g, sales: round(g.sales), discounts: round(g.discounts), vat: round(g.vat), returns: round(g.returns), net: round(g.net) }))
    .sort((a, b) => b.net - a.net);
}
