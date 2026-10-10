import { apiFetch, fetchAllPages, type Page, withQuery } from "@mms/ui";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3006";

export type PaymentMethodType = "CASH" | "CARD" | "GIFT_CARD";

export interface Promotion {
  id: string;
  discountPct: string;
  startsAt: string;
  endsAt: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  unitPrice: string;
  taxRatePct: string;
  promotions: Promotion[];
}

export interface TransactionLine {
  id: string;
  sku: string;
  productName: string;
  quantitySold: number;
  unitPrice: string;
  discountAmount: string;
  taxAmount: string;
  lineTotal: string;
  reservationId: string;
  locationCode: string;
  quantityReturned: number;
}

export interface PaymentCapture {
  id: string;
  method: PaymentMethodType;
  amount: string;
}

export interface Transaction {
  id: string;
  transactionNumber: string;
  storeId: string;
  registerId: string;
  cashierId: string;
  status: "COMPLETED" | "RETURNED";
  subtotalAmount: string;
  discountAmount: string;
  taxAmount: string;
  totalAmount: string;
  createdAt: string;
  lines: TransactionLine[];
  payments: PaymentCapture[];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(`${API_URL}${path}`, {
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
  productsUrl: `${API_URL}/products`,

  /** The whole price list — the till's catalog. */
  listProducts: () =>
    fetchAllPages((page, pageSize) => request<Page<Product>>(withQuery("/products", { page, pageSize }))),

  getProduct: (sku: string) => request<Product>(`/products/${encodeURIComponent(sku)}`),

  createProduct: (data: { sku: string; name: string; unitPrice: number; taxRatePct?: number }) =>
    request<Product>("/products", { method: "POST", body: JSON.stringify(data) }),

  updateProduct: (sku: string, data: Partial<{ name: string; unitPrice: number; taxRatePct: number }>) =>
    request<Product>(`/products/${encodeURIComponent(sku)}`, { method: "PATCH", body: JSON.stringify(data) }),

  addPromotion: (sku: string, data: { discountPct: number; startsAt: string; endsAt: string }) =>
    request<Promotion>(`/products/${encodeURIComponent(sku)}/promotions`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  /** The store's 100 newest sales — what a cashier picks from for a return. */
  listRecentTransactions: (storeId?: string) =>
    request<Page<Transaction>>(withQuery("/transactions", { storeId, pageSize: 100 })).then((page) => page.items),

  getTransaction: (id: string) => request<Transaction>(`/transactions/${id}`),

  checkout: (data: {
    storeId: string;
    registerId: string;
    locationCode: string;
    lines: { sku: string; quantity: number }[];
    payments: { method: PaymentMethodType; amount: number }[];
  }) => request<Transaction>("/checkout", { method: "POST", body: JSON.stringify(data) }),

  processReturn: (data: {
    originalTransactionId: string;
    storeId: string;
    registerId: string;
    lines: { transactionLineId: string; quantityReturned: number }[];
  }) => request<unknown>("/returns", { method: "POST", body: JSON.stringify(data) }),
};
