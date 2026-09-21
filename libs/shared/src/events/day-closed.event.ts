/**
 * Published by Sales Audit (FR-7.6) once a store's day is balanced (or the
 * discrepancy explained) and closed. Reconciliation is store-level, not
 * per-register (D-4). Financials (FR-8.3, Phase 4) books
 * `discrepancyAmount` as a cash-over/short expense/adjustment entry.
 */
export interface DayClosedEvent {
  eventId: string;
  occurredAt: string;
  storeId: string;
  businessDate: string;
  expectedTotal: number;
  actualCountedTotal: number;
  /** actualCountedTotal - expectedTotal; negative = shortage, positive = overage */
  discrepancyAmount: number;
  discrepancyExplanation: string | null;
  closedByManagerId: string;
}
