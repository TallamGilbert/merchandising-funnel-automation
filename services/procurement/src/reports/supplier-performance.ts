/**
 * D-20 — how well each supplier fills what was ordered. Pure, unit-tested.
 * Fill rate only counts closed POs (an order still arriving isn't a
 * shortfall yet), and over-delivery is capped at what was ordered.
 */
export interface PoForPerformance {
  supplierId: string;
  supplierName: string;
  status: string;
  currency: string;
  totalAmount: number;
  lines: { quantityOrdered: number; quantityReceived: number }[];
}

export interface SupplierPerformanceRow {
  supplierId: string;
  supplierName: string;
  purchaseOrders: number;
  openOrders: number;
  closedOrders: number;
  /** KES only — other currencies are counted, never converted (PRD §2.2). */
  spendKes: number;
  otherCurrencyOrders: number;
  unitsOrdered: number;
  unitsReceived: number;
  /** Received ÷ ordered on closed POs, 0–1; null until a PO closes. */
  fillRate: number | null;
}

export function supplierPerformance(orders: PoForPerformance[]): SupplierPerformanceRow[] {
  const rows = new Map<string, SupplierPerformanceRow & { closedOrdered: number; closedReceived: number }>();
  for (const po of orders) {
    const row = rows.get(po.supplierId) ?? {
      supplierId: po.supplierId,
      supplierName: po.supplierName,
      purchaseOrders: 0,
      openOrders: 0,
      closedOrders: 0,
      spendKes: 0,
      otherCurrencyOrders: 0,
      unitsOrdered: 0,
      unitsReceived: 0,
      fillRate: null,
      closedOrdered: 0,
      closedReceived: 0,
    };
    row.purchaseOrders++;
    if (po.currency === "KES") row.spendKes += po.totalAmount;
    else row.otherCurrencyOrders++;
    const closed = po.status === "CLOSED";
    if (closed) row.closedOrders++;
    else row.openOrders++;
    for (const line of po.lines) {
      const received = Math.min(line.quantityReceived, line.quantityOrdered);
      row.unitsOrdered += line.quantityOrdered;
      row.unitsReceived += received;
      if (closed) {
        row.closedOrdered += line.quantityOrdered;
        row.closedReceived += received;
      }
    }
    rows.set(po.supplierId, row);
  }
  return [...rows.values()]
    .map(({ closedOrdered, closedReceived, ...row }) => ({
      ...row,
      spendKes: Math.round(row.spendKes * 100) / 100,
      fillRate: closedOrdered > 0 ? Math.round((closedReceived / closedOrdered) * 1000) / 1000 : null,
    }))
    .sort((a, b) => b.spendKes - a.spendKes || a.supplierName.localeCompare(b.supplierName));
}
