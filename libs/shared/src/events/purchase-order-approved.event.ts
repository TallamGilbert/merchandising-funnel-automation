/**
 * Published by Procurement (FR-2.6) when a PO clears its approval workflow.
 *
 * Implementation note: PRD Section 5's summary table also lists Inventory
 * and Financials as consumers, but neither module's own FR block (4.4, 4.8)
 * declares `PurchaseOrderApproved` in its "Consumes" line — Inventory's
 * FR-4.3 tracks only On Hand/Allocated/Available (no "on order" figure to
 * update), and Financials' FR-8.1 books its ledger entry off `GoodsReceived`,
 * not PO approval. Per the brief in this repo, module-level FR text is
 * treated as binding over the cross-cutting summary table where they
 * disagree, so only Receiving (FR-3.7) is wired as a consumer.
 */
export interface PurchaseOrderApprovedEvent {
  eventId: string;
  occurredAt: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  paymentTermsDays: number;
  currency: string;
  approvedById: string;
  approvedAt: string;
  lines: PurchaseOrderApprovedLine[];
}

export interface PurchaseOrderApprovedLine {
  sku: string;
  productName: string;
  quantityOrdered: number;
  unitCost: number;
}
