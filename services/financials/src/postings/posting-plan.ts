import { JournalDraft } from "../ledger/journal";

export interface BillDraft {
  goodsReceivedNoteNumber: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  amount: number;
  currency: string;
  billDate: Date;
  dueDate: Date;
}

export interface SaleFactDraft {
  occurredAt: Date;
  businessDate: string;
  storeId: string;
  transactionId: string;
  returnId?: string;
  sku: string;
  productName: string;
  /** Negative for returns. */
  quantity: number;
  revenue: number;
  taxAmount: number;
  cogs: number;
  unitCost: number;
}

/** Everything one event changes in the books, committed together or not at all. */
export interface PostingPlan {
  /** null when the event moves no money (e.g. a balanced day close). */
  entry: JournalDraft | null;
  bill?: BillDraft;
  facts?: SaleFactDraft[];
}
