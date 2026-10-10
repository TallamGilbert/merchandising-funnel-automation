/**
 * Read-only lookups into other modules' public REST APIs, used to fill
 * pickers. Each app still talks to its own module through its own lib/api.
 */
import { apiFetch } from "../auth/client";
import { fetchAllPages, Page, withQuery } from "../lists/page";

const INVENTORY_URL = process.env.NEXT_PUBLIC_INVENTORY_URL ?? "http://localhost:3003";
const PROCUREMENT_URL = process.env.NEXT_PUBLIC_PROCUREMENT_URL ?? "http://localhost:3002";

export interface CatalogProduct {
  sku: string;
  name: string;
  unitCost: string;
}

export interface StockLevelSummary {
  sku: string;
  locationCode: string;
  onHand: number;
  allocated: number;
  available: number;
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
  const res = await apiFetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

/** Pickers offer the whole list, so these walk every page. */
export const lookupApi = {
  listCatalogProducts: () =>
    fetchAllPages((page, pageSize) =>
      get<Page<CatalogProduct>>(withQuery(`${INVENTORY_URL}/products`, { page, pageSize })),
    ),
  listStockLevels: (locationCode?: string) =>
    fetchAllPages((page, pageSize) =>
      get<Page<StockLevelSummary>>(withQuery(`${INVENTORY_URL}/stock-levels`, { locationCode, page, pageSize })),
    ),
  listPurchaseOrders: () =>
    fetchAllPages((page, pageSize) =>
      get<Page<PurchaseOrderSummary>>(withQuery(`${PROCUREMENT_URL}/purchase-orders`, { page, pageSize })),
    ),
};
