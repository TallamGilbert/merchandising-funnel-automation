const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";
const VENDOR_MANAGEMENT_URL =
  process.env.NEXT_PUBLIC_VENDOR_MANAGEMENT_URL ?? "http://localhost:3001";

export type PurchaseOrderStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "SENT"
  | "PARTIALLY_RECEIVED"
  | "CLOSED";

export type ReorderSuggestionStatus = "NEW" | "DISMISSED" | "CONVERTED";

export interface PurchaseOrderLine {
  id: string;
  sku: string;
  productName: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: string;
}

export interface PurchaseOrder {
  id: string;
  sequence: number;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  status: PurchaseOrderStatus;
  paymentTermsDays: number;
  currency: string;
  totalAmount: string;
  requestedById: string;
  approvedById: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lines: PurchaseOrderLine[];
}

export interface ReorderSuggestion {
  id: string;
  sku: string;
  reason: string;
  sourceEventId: string;
  status: ReorderSuggestionStatus;
  createdAt: string;
}

export interface SupplierSummary {
  id: string;
  name: string;
  status: "ACTIVE" | "ARCHIVED";
}

export interface SupplierOfferedProduct {
  sku: string;
  productName: string;
  unitCost: string;
  currency: string;
}

async function request<T>(base: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base}${path}`, {
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
  listPurchaseOrders: (status?: PurchaseOrderStatus) =>
    request<PurchaseOrder[]>(
      API_URL,
      `/purchase-orders${status ? `?status=${status}` : ""}`,
    ),

  getPurchaseOrder: (id: string) => request<PurchaseOrder>(API_URL, `/purchase-orders/${id}`),

  createPurchaseOrder: (data: {
    supplierId: string;
    requestedById: string;
    lines: { sku: string; quantityOrdered: number }[];
  }) =>
    request<PurchaseOrder>(API_URL, "/purchase-orders", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  submit: (id: string) =>
    request<PurchaseOrder>(API_URL, `/purchase-orders/${id}/submit`, { method: "POST" }),

  approve: (id: string, data: { approvedById: string; approverRole: "MANAGER" | "OWNER" }) =>
    request<PurchaseOrder>(API_URL, `/purchase-orders/${id}/approve`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  markSent: (id: string) =>
    request<PurchaseOrder>(API_URL, `/purchase-orders/${id}/mark-sent`, { method: "POST" }),

  listReorderSuggestions: (status?: ReorderSuggestionStatus) =>
    request<ReorderSuggestion[]>(
      API_URL,
      `/reorder-suggestions${status ? `?status=${status}` : ""}`,
    ),

  dismissReorderSuggestion: (id: string) =>
    request<ReorderSuggestion>(API_URL, `/reorder-suggestions/${id}/dismiss`, {
      method: "POST",
    }),

  // Vendor Management is read directly to populate the supplier/SKU pickers
  // when building a PO — Procurement's own backend only prices a PO once
  // supplierId + lines are already chosen.
  listActiveSuppliers: () =>
    request<SupplierSummary[]>(VENDOR_MANAGEMENT_URL, "/suppliers?status=ACTIVE"),

  getSupplierProducts: (supplierId: string) =>
    request<{ products: SupplierOfferedProduct[] }>(
      VENDOR_MANAGEMENT_URL,
      `/suppliers/${supplierId}`,
    ).then((s) => s.products),
};
