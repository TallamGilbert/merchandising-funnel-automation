/**
 * Published by Retail Sales (FR-6.6) immediately after a transaction
 * completes. Carries sale facts only — no wholesale unit cost and no
 * supplier identity ("Retail Sales does not know who the supplier was").
 * Financials (FR-8.2, Phase 4) resolves COGS by calling Inventory (REST)
 * for the product's current unit cost, keyed by `sku`.
 */
export interface ItemSoldEvent {
  eventId: string;
  occurredAt: string;
  transactionId: string;
  storeId: string;
  registerId: string;
  cashierId: string;
  lines: ItemSoldLine[];
  paymentMethods: PaymentMethodCapture[];
  totalAmount: number;
}

export interface ItemSoldLine {
  sku: string;
  productName: string;
  quantitySold: number;
  unitPrice: number;
  discountAmount: number;
  taxAmount: number;
  lineTotal: number;
  /**
   * Id of the Reservation created by the earlier gRPC CheckAndReserveStock
   * call at checkout (FR-6.2). Inventory resolves location/allocation from
   * this reservation rather than the event carrying its own location field.
   */
  reservationId: string;
}

export type PaymentMethodType = "CASH" | "CARD" | "GIFT_CARD";

export interface PaymentMethodCapture {
  method: PaymentMethodType;
  amount: number;
}
