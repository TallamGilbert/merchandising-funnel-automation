/**
 * Published by Retail Sales (FR-6.4) when a return/exchange is processed.
 * Reverses part or all of an earlier sale; no inspection step in v1 (D-5) —
 * the full returned quantity goes straight back to Available. Consumed by
 * Inventory, which adds it back onto On Hand at the location the sale was
 * fulfilled from. See PRD Decisions Log D-8.
 *
 * `returnId` is the idempotency key — a consumer must apply each return at
 * most once even if the bus redelivers.
 */
export interface ItemReturnedEvent {
  eventId: string;
  occurredAt: string;
  returnId: string;
  originalTransactionId: string;
  storeId: string;
  registerId: string;
  lines: ItemReturnedLine[];
}

export interface ItemReturnedLine {
  sku: string;
  productName: string;
  quantityReturned: number;
  locationCode: string;
  refundAmount: number;
}
