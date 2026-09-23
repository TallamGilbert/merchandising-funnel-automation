/**
 * Published by Receiving (FR-3.6) once a GRN is finalized.
 *
 * Deliberately carries physical facts only — no unit cost. The brief is
 * explicit that "Receiving does not know the financial value of the goods,"
 * so this payload never includes it. Financials (FR-8.1, Phase 4) values the
 * resulting inventory increase / accounts-payable entry by calling
 * Procurement's PO endpoint (REST) with `poNumber` to read the frozen
 * `unitCost` it locked at approval time — it does not get cost from this
 * event.
 *
 * `condition: "DAMAGED"` lines are quarantined per FR-3.4 and must never be
 * added to sellable On Hand by a consumer (see Inventory's goods-received
 * handler).
 */
export interface GoodsReceivedEvent {
  eventId: string;
  occurredAt: string;
  goodsReceivedNoteNumber: string;
  poNumber: string;
  supplierId: string;
  receivedAtLocation: string;
  lines: GoodsReceivedLine[];
}

export type GoodsReceivedCondition = "GOOD" | "DAMAGED";
export type GoodsReceivedDiscrepancy =
  | "NONE"
  | "SHORTAGE"
  | "OVERAGE"
  | "DAMAGE";

export interface GoodsReceivedLine {
  sku: string;
  productName: string;
  quantityOrdered: number;
  quantityReceived: number;
  condition: GoodsReceivedCondition;
  discrepancyType: GoodsReceivedDiscrepancy;
}
