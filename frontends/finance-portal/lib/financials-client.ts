const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3008";

export type EntrySource = "GOODS_RECEIVED" | "ITEM_SOLD" | "ITEM_RETURNED" | "DAY_CLOSED" | "BILL_PAYMENT";
export type BillStatus = "OPEN" | "PAID";
export type InboxStatus = "PENDING" | "POSTED" | "NEEDS_ATTENTION";
export type AgingBucket = "current" | "1-30" | "31-60" | "61-90" | "90+";
export type ProfitGrouping = "product" | "store" | "day";

export const SOURCE_LABEL: Record<EntrySource, string> = {
  GOODS_RECEIVED: "Goods received",
  ITEM_SOLD: "Sale",
  ITEM_RETURNED: "Refund",
  DAY_CLOSED: "Day close",
  BILL_PAYMENT: "Bill payment",
};

export interface Account {
  code: string;
  name: string;
  type: "ASSET" | "LIABILITY" | "REVENUE" | "EXPENSE";
}

// Prisma Decimals arrive as strings over JSON.
export interface JournalEntry {
  id: string;
  sequence: number;
  occurredAt: string;
  postedAt: string;
  source: EntrySource;
  sourceRef: string;
  description: string;
  storeId: string | null;
  lines: { id: string; accountCode: string; debit: string; credit: string; memo: string | null }[];
}

export interface TrialBalance {
  asOf: string | null;
  rows: { code: string; name: string; type: Account["type"]; debit: number; credit: number; balance: number }[];
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
}

export interface PayableBill {
  id: string;
  goodsReceivedNoteNumber: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  amount: string;
  currency: string;
  billDate: string;
  dueDate: string;
  status: BillStatus;
  paidAt: string | null;
  paymentReference: string | null;
  daysOverdue: number;
  agingBucket: AgingBucket | null;
}

export interface AgingReport {
  asOf: string;
  buckets: AgingBucket[];
  suppliers: { supplierId: string; supplierName: string; buckets: Record<AgingBucket, number>; total: number }[];
  totals: Record<AgingBucket, number>;
  totalOutstanding: number;
}

export interface ProfitRow {
  key: string;
  label: string;
  quantity: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  marginPct: number | null;
}

export interface Profitability {
  from: string;
  to: string;
  groupBy: ProfitGrouping;
  rows: ProfitRow[];
  total: ProfitRow;
}

export interface Summary {
  from: string;
  to: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  marginPct: number | null;
  cashOverShort: number;
  payables: { outstanding: number; openBills: number; overdue: number; overdueBills: number };
  inbox: { pending: number; needsAttention: number };
  daily: { date: string; revenue: number; cogs: number; grossProfit: number }[];
}

export interface InboxEvent {
  eventId: string;
  routingKey: string;
  payload: Record<string, unknown>;
  status: InboxStatus;
  attempts: number;
  lastError: string | null;
  receivedAt: string;
  nextAttempt: string;
  postedAt: string | null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message = Array.isArray(body?.message) ? body.message.join(", ") : (body?.message ?? res.statusText);
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

/** Builds a `?key=value` query string, dropping params that are empty or undefined. */
function toQueryString(params: Record<string, string | undefined>): string {
  const presentParams = Object.entries(params).filter(
    (entry): entry is [string, string] => {
      const [, value] = entry;
      return Boolean(value);
    },
  );
  if (presentParams.length === 0) return "";
  return `?${new URLSearchParams(presentParams)}`;
}

export const api = {
  summary: (from: string, to: string) => request<Summary>(`/reports/summary${toQueryString({ from, to })}`),

  profitability: (from: string, to: string, groupBy: ProfitGrouping) =>
    request<Profitability>(`/reports/profitability${toQueryString({ from, to, groupBy })}`),

  accounts: () => request<Account[]>("/accounts"),

  entries: (filter: { from?: string; to?: string; accountCode?: string; source?: EntrySource }) =>
    request<JournalEntry[]>(`/ledger/entries${toQueryString({ ...filter, limit: "200" })}`),

  trialBalance: (asOf?: string) => request<TrialBalance>(`/ledger/trial-balance${toQueryString({ asOf })}`),

  payables: (status?: BillStatus) => request<PayableBill[]>(`/payables${toQueryString({ status })}`),

  aging: () => request<AgingReport>("/payables/aging"),

  payBill: (id: string, data: { paymentReference?: string; paidOn?: string }) =>
    request<PayableBill>(`/payables/${id}/pay`, { method: "POST", body: JSON.stringify(data) }),

  inbox: (status?: InboxStatus) => request<InboxEvent[]>(`/inbox${toQueryString({ status })}`),

  retryEvent: (eventId: string) =>
    request<{ eventId: string; result: string }>(`/inbox/${encodeURIComponent(eventId)}/retry`, { method: "POST" }),
};
