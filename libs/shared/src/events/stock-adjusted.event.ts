/**
 * Published by Inventory when on-hand stock is corrected outside the normal
 * flows — a posted stock count (a stocktake or cycle count) or a manual
 * adjustment (D-19). Consumed by Financials, which books the value of the
 * change as inventory shrinkage (a loss) or its reversal (a gain), so the
 * ledger's Inventory account keeps matching Inventory's own valuation.
 *
 * `reference` is the idempotency key together with `kind`: a stock count
 * number (SC-1001) or the adjustment's transaction id.
 */
export interface StockAdjustedEvent {
  eventId: string;
  occurredAt: string;
  kind: "STOCK_COUNT" | "MANUAL";
  reference: string;
  locationCode: string;
  /** Why — the count's notes or the adjustment reason. */
  description: string;
  /** Who posted the count or made the adjustment. */
  adjustedById: string;
  lines: StockAdjustedLine[];
}

export interface StockAdjustedLine {
  sku: string;
  productName: string;
  /** Positive: found more than the books said. Negative: missing. */
  quantityDelta: number;
  /** Inventory's unit cost (the valuation baseline, FR-4.4) when posted. */
  unitCost: number;
}
