/**
 * Published by Warehouse Operations (FR-5.4) when every pick for a transfer
 * between locations (e.g. warehouse -> showroom) has been confirmed. Consumed
 * by Inventory, which moves On Hand from `fromLocationCode` to
 * `toLocationCode` (FR-4.1). See PRD Decisions Log D-7.
 *
 * `transferNumber` is the idempotency key — a consumer must apply each
 * transfer at most once even if the bus redelivers. Physical facts only: no
 * cost, and no bin codes (Inventory never decides or tracks bin placement).
 */
export interface StockTransferredEvent {
  eventId: string;
  occurredAt: string;
  transferNumber: string;
  sku: string;
  quantity: number;
  fromLocationCode: string;
  toLocationCode: string;
}
