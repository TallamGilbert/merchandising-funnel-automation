const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3007";

export type DailyCloseStatus = "OPEN" | "BLOCKED_ON_EXPLANATION" | "CLOSED";

export interface DailyClose {
  id: string;
  storeId: string;
  businessDate: string;
  expectedTotal: string;
  actualCountedTotal: string | null;
  discrepancyAmount: string | null;
  discrepancyExplanation: string | null;
  status: DailyCloseStatus;
  closedByManagerId: string | null;
  closedAt: string | null;
}

export interface CashierLedgerLine {
  id: string;
  cashierId: string;
  registerId: string;
  expectedAmount: string;
}

export interface StoreDayLedger {
  id: string;
  storeId: string;
  businessDate: string;
  expectedTotal: string;
  cashierLines: CashierLedgerLine[];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message = Array.isArray(body?.message)
      ? body.message.join(", ")
      : (body?.message ?? res.statusText);
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  getLedger: (storeId: string, businessDate: string) =>
    request<StoreDayLedger | null>(
      `/stores/${encodeURIComponent(storeId)}/ledger?businessDate=${businessDate}`,
    ),

  getDailyClose: (storeId: string, businessDate: string) =>
    request<DailyClose | null>(
      `/stores/${encodeURIComponent(storeId)}/daily-close?businessDate=${businessDate}`,
    ),

  recordCount: (storeId: string, businessDate: string, actualCountedTotal: number) =>
    request<DailyClose>(`/stores/${encodeURIComponent(storeId)}/daily-close/count`, {
      method: "POST",
      body: JSON.stringify({ businessDate, actualCountedTotal }),
    }),

  explainDiscrepancy: (storeId: string, businessDate: string, explanation: string) =>
    request<DailyClose>(`/stores/${encodeURIComponent(storeId)}/daily-close/explain`, {
      method: "POST",
      body: JSON.stringify({ businessDate, explanation }),
    }),

  closeDay: (storeId: string, businessDate: string, closedByManagerId: string) =>
    request<DailyClose>(`/stores/${encodeURIComponent(storeId)}/daily-close/close`, {
      method: "POST",
      body: JSON.stringify({ businessDate, closedByManagerId }),
    }),
};
