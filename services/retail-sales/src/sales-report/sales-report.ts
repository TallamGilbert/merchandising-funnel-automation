/**
 * Pure aggregation for the manager sales report (D-20): no database, so
 * every grouping rule is unit-tested on plain rows.
 */

export const SALES_GROUPINGS = ["cashier", "hour", "day", "sku", "store"] as const;
export type SalesGrouping = (typeof SALES_GROUPINGS)[number];

export interface SaleRow {
  id: string;
  storeId: string;
  cashierId: string;
  createdAt: Date;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  lines: { sku: string; productName: string; quantitySold: number; discountAmount: number; taxAmount: number; lineTotal: number }[];
}

export interface ReturnRow {
  createdAt: Date;
  storeId: string;
  refundAmount: number;
  /** Returns count against the cashier who made the original sale. */
  originalCashierId: string;
  lines: { sku: string; productName: string; quantityReturned: number; refundAmount: number }[];
}

export interface SalesReportRow {
  key: string;
  /** Product name for sku rows; otherwise the key. */
  label: string;
  transactions: number;
  units: number;
  /** What customers paid: after discounts, VAT included. */
  sales: number;
  discounts: number;
  vat: number;
  returns: number;
  unitsReturned: number;
  /** sales − returns. */
  net: number;
}

interface Bucket extends SalesReportRow {
  saleIds: Set<string>;
}

/** Hour of day ("00"–"23") in the report's time zone — a manager thinks in local time. */
export function hourKey(at: Date, timeZone: string): string {
  const hour = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone }).format(at);
  return hour.padStart(2, "0");
}

export function buildSalesReport(
  sales: SaleRow[],
  returns: ReturnRow[],
  groupBy: SalesGrouping,
  timeZone: string,
): SalesReportRow[] {
  const buckets = new Map<string, Bucket>();
  const bucket = (key: string, label = key) => {
    let b = buckets.get(key);
    if (!b) {
      b = { key, label, transactions: 0, units: 0, sales: 0, discounts: 0, vat: 0, returns: 0, unitsReturned: 0, net: 0, saleIds: new Set() };
      buckets.set(key, b);
    }
    return b;
  };
  const keyOf = (row: { storeId: string; createdAt: Date }, cashierId: string): string => {
    switch (groupBy) {
      case "cashier":
        return cashierId;
      case "hour":
        return hourKey(row.createdAt, timeZone);
      case "day":
        return row.createdAt.toISOString().slice(0, 10);
      case "store":
        return row.storeId;
      default:
        throw new Error(`keyOf is not used for ${groupBy}`);
    }
  };

  if (groupBy === "sku") {
    for (const sale of sales) {
      for (const line of sale.lines) {
        const b = bucket(line.sku, line.productName);
        b.saleIds.add(sale.id);
        b.units += line.quantitySold;
        b.sales += line.lineTotal;
        b.discounts += line.discountAmount;
        b.vat += line.taxAmount;
      }
    }
    for (const ret of returns) {
      for (const line of ret.lines) {
        const b = bucket(line.sku, line.productName);
        b.returns += line.refundAmount;
        b.unitsReturned += line.quantityReturned;
      }
    }
  } else {
    for (const sale of sales) {
      const b = bucket(keyOf(sale, sale.cashierId));
      b.saleIds.add(sale.id);
      b.units += sale.lines.reduce((sum, l) => sum + l.quantitySold, 0);
      b.sales += sale.totalAmount;
      b.discounts += sale.discountAmount;
      b.vat += sale.taxAmount;
    }
    for (const ret of returns) {
      const b = bucket(keyOf(ret, ret.originalCashierId));
      b.returns += ret.refundAmount;
      b.unitsReturned += ret.lines.reduce((sum, l) => sum + l.quantityReturned, 0);
    }
  }

  const rows = [...buckets.values()].map(({ saleIds, ...b }) => ({
    ...b,
    transactions: saleIds.size,
    sales: round2(b.sales),
    discounts: round2(b.discounts),
    vat: round2(b.vat),
    returns: round2(b.returns),
    net: round2(b.sales - b.returns),
  }));

  // Time reads in order; everything else biggest first.
  return groupBy === "hour" || groupBy === "day"
    ? rows.sort((a, b) => a.key.localeCompare(b.key))
    : rows.sort((a, b) => b.net - a.net || a.key.localeCompare(b.key));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
