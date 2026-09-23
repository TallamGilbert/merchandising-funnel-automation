const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3004";

export type ExpectedDeliveryStatus = "EXPECTED" | "PARTIALLY_RECEIVED" | "RECEIVED";
export type GoodsReceivedNoteStatus = "DRAFT" | "FINALIZED";
export type GoodsReceivedNoteCondition = "GOOD" | "DAMAGED";
export type GoodsReceivedNoteDiscrepancyType = "NONE" | "SHORTAGE" | "OVERAGE" | "DAMAGE";

export interface ExpectedDeliveryLine {
  id: string;
  sku: string;
  productName: string;
  quantityOrdered: number;
  quantityReceived: number;
}

export interface ExpectedDelivery {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  status: ExpectedDeliveryStatus;
  createdAt: string;
  updatedAt: string;
  lines: ExpectedDeliveryLine[];
}

export interface GoodsReceivedNoteLine {
  id: string;
  sku: string;
  productName: string;
  quantityOrdered: number;
  quantityReceived: number;
  condition: GoodsReceivedNoteCondition;
  discrepancyType: GoodsReceivedNoteDiscrepancyType;
  quarantined: boolean;
  notes: string | null;
}

export interface GoodsReceivedNote {
  id: string;
  goodsReceivedNoteNumber: string;
  poNumber: string;
  supplierId: string;
  receivedAtLocation: string;
  receivedById: string;
  status: GoodsReceivedNoteStatus;
  finalizedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lines: GoodsReceivedNoteLine[];
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
  listExpectedDeliveries: (status?: ExpectedDeliveryStatus) =>
    request<ExpectedDelivery[]>(`/expected-deliveries${status ? `?status=${status}` : ""}`),

  listGoodsReceivedNotes: (status?: GoodsReceivedNoteStatus) =>
    request<GoodsReceivedNote[]>(`/goods-received-notes${status ? `?status=${status}` : ""}`),

  getGoodsReceivedNote: (id: string) => request<GoodsReceivedNote>(`/goods-received-notes/${id}`),

  createGoodsReceivedNote: (data: { poNumber: string; receivedAtLocation: string; receivedById: string }) =>
    request<GoodsReceivedNote>("/goods-received-notes", { method: "POST", body: JSON.stringify(data) }),

  recordScan: (
    id: string,
    data: { sku: string; quantity: number; condition: GoodsReceivedNoteCondition; notes?: string },
  ) => request<GoodsReceivedNote>(`/goods-received-notes/${id}/scans`, { method: "POST", body: JSON.stringify(data) }),

  finalizeGoodsReceivedNote: (id: string) =>
    request<GoodsReceivedNote>(`/goods-received-notes/${id}/finalize`, { method: "POST" }),
};
