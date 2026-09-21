const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3004";

export type ExpectedDeliveryStatus = "EXPECTED" | "PARTIALLY_RECEIVED" | "RECEIVED";
export type GrnStatus = "DRAFT" | "FINALIZED";
export type GrnCondition = "GOOD" | "DAMAGED";
export type GrnDiscrepancyType = "NONE" | "SHORTAGE" | "OVERAGE" | "DAMAGE";

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

export interface GrnLine {
  id: string;
  sku: string;
  productName: string;
  quantityOrdered: number;
  quantityReceived: number;
  condition: GrnCondition;
  discrepancyType: GrnDiscrepancyType;
  quarantined: boolean;
  notes: string | null;
}

export interface Grn {
  id: string;
  grnNumber: string;
  poNumber: string;
  supplierId: string;
  receivedAtLocation: string;
  receivedById: string;
  status: GrnStatus;
  finalizedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lines: GrnLine[];
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

  listGrns: (status?: GrnStatus) =>
    request<Grn[]>(`/grns${status ? `?status=${status}` : ""}`),

  getGrn: (id: string) => request<Grn>(`/grns/${id}`),

  createGrn: (data: { poNumber: string; receivedAtLocation: string; receivedById: string }) =>
    request<Grn>("/grns", { method: "POST", body: JSON.stringify(data) }),

  recordScan: (
    id: string,
    data: { sku: string; quantity: number; condition: GrnCondition; notes?: string },
  ) => request<Grn>(`/grns/${id}/scans`, { method: "POST", body: JSON.stringify(data) }),

  finalizeGrn: (id: string) => request<Grn>(`/grns/${id}/finalize`, { method: "POST" }),
};
