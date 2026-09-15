/**
 * Published by Inventory (FR-4.6) when a product's Available quantity
 * crosses its dynamic, velocity-derived reorder threshold (D-3). Consumed by
 * Procurement (FR-2.7) to surface a reorder suggestion — no auto-ordering.
 */
export interface StockLowEvent {
  eventId: string;
  occurredAt: string;
  sku: string;
  productName: string;
  locationCode: string;
  availableQuantity: number;
  dynamicReorderThreshold: number;
  salesVelocityUnitsPerDay: number;
}
