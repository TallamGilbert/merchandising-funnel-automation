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
  getProduct: (sku: string) => request<Product>(`/products/${encodeURIComponent(sku)}`),

  getTransaction: (id: string) => request<Transaction>(`/transactions/${id}`),

  checkout: (data: {
    storeId: string;
    registerId: string;
    cashierId: string;
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
