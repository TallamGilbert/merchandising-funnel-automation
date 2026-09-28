/**
 * Read-only lookups into other modules' public REST APIs, used to fill
 * pickers. Each app still talks to its own module through its own lib/api.
 */
const INVENTORY_URL = process.env.NEXT_PUBLIC_INVENTORY_URL ?? "http://localhost:3003";
const PROCUREMENT_URL = process.env.NEXT_PUBLIC_PROCUREMENT_URL ?? "http://localhost:3002";

export interface CatalogProduct {
  sku: string;
  name: string;
  unitCost: string;
}

export type PurchaseOrderStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "SENT"
  | "PARTIALLY_RECEIVED"
  | "CLOSED";

export interface PurchaseOrderSummary {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  status: PurchaseOrderStatus;
  currency: string;
  totalAmount: string;
  createdAt: string;
}

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export const lookupApi = {
  listCatalogProducts: () => get<CatalogProduct[]>(`${INVENTORY_URL}/products`),
  listPurchaseOrders: () => get<PurchaseOrderSummary[]>(`${PROCUREMENT_URL}/purchase-orders`),
};
