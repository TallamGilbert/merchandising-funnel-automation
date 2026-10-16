import { apiFetch, fetchAllPages, type ListParams, type Page, withQuery } from "@mms/ui";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3003";

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  lengthCm: string | null;
  widthCm: string | null;
  heightCm: string | null;
  weightKg: string | null;
  unitCost: string;
  category: string | null;
  createdAt: string;
  updatedAt: string;
}

export type StockCountType = "FULL" | "CYCLE";
export type StockCountStatus = "OPEN" | "SUBMITTED" | "POSTED" | "CANCELLED";
export type UncountedHandling = "reject" | "skip" | "zero";

/** Progress and variance totals; null while a blind count hides them from you. */
export interface CountSummary {
  lineCount: number;
  countedLines: number;
  linesWithVariance: number | null;
  unitsOver: number | null;
  unitsShort: number | null;
  varianceValue: number | null;
}

export interface StockCount extends CountSummary {
  id: string;
  countNumber: string;
  locationCode: string;
  type: StockCountType;
  status: StockCountStatus;
  blind: boolean;
  notes: string | null;
  createdById: string;
  submittedById: string | null;
  submittedAt: string | null;
  postedById: string | null;
  postedAt: string | null;
  cancelledById: string | null;
  cancelledAt: string | null;
  createdAt: string;
}

export interface StockCountLine {
  id: string;
  sku: string;
  productName: string;
  expectedQty: number | null;
  countedQty: number | null;
  variance: number | null;
  countedById: string | null;
  countedAt: string | null;
  unitCost: string;
}

export interface StockCountDetail extends StockCount {
  lines: StockCountLine[];
  /** True when you're counting blind: expected quantities are hidden. */
  expectedHidden: boolean;
}

export type MovementStatus = "DEAD" | "SLOW" | "OK";

export interface MovementRow {
  sku: string;
  productName: string;
  category: string | null;
  locationCode: string;
  onHand: number;
  unitCost: number;
  stockValue: number;
  unitsSold: number;
  lastSaleAt: string | null;
  daysOfCover: number | null;
  status: MovementStatus;
}

export interface CountSuggestion {
  sku: string;
  productName: string;
  onHand: number;
  stockValue: number;
  lastCountedAt: string | null;
}

export interface StockLevel {
  id: string;
  productId: string;
  sku: string;
  productName: string;
  locationCode: string;
  onHand: number;
  allocated: number;
  available: number;
  unitValue: string;
  updatedAt: string;
}

export interface SalesVelocity {
  id: string;
  productId: string;
  unitsPerDay: string;
  windowDays: number;
  computedAt: string;
}

export interface ProductDetail extends Product {
  stockLevels: StockLevel[];
  salesVelocity: SalesVelocity | null;
}

export interface ValuationReport {
  asOf: string;
  totalValue: number;
  byProduct: { sku: string; productName: string; onHand: number; unitCost: number; totalValue: number }[];
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
  stockLevelsUrl: `${API_URL}/stock-levels`,
  stockCountsUrl: `${API_URL}/stock-counts`,

  /** `q` matches the count number; filters: status, locationCode. */
  listStockCounts: (params: ListParams) => request<Page<StockCount>>(withQuery("/stock-counts", params)),

  getStockCount: (id: string) => request<StockCountDetail>(`/stock-counts/${id}`),

  createStockCount: (data: {
    locationCode: string;
    type: StockCountType;
    skus?: string[];
    category?: string;
    blind?: boolean;
    notes?: string;
  }) => request<StockCountDetail>("/stock-counts", { method: "POST", body: JSON.stringify(data) }),

  recordCount: (id: string, sku: string, countedQty: number) =>
    request<StockCountDetail>(`/stock-counts/${id}/lines/${encodeURIComponent(sku)}`, {
      method: "PUT",
      body: JSON.stringify({ countedQty }),
    }),

  submitStockCount: (id: string, uncounted: UncountedHandling) =>
    request<StockCountDetail>(`/stock-counts/${id}/submit`, { method: "POST", body: JSON.stringify({ uncounted }) }),

  postStockCount: (id: string) => request<StockCountDetail>(`/stock-counts/${id}/post`, { method: "POST" }),

  cancelStockCount: (id: string) => request<StockCountDetail>(`/stock-counts/${id}/cancel`, { method: "POST" }),

  stockMovementUrl: `${API_URL}/reports/stock-movement`,

  /** D-20 — slow movers and dead stock. */
  stockMovement: (params: { locationCode?: string; category?: string; days?: number; slowAfterDays?: number }) =>
    request<MovementRow[]>(withQuery("/reports/stock-movement", params)),

  countSuggestions: (locationCode: string, limit = 20) =>
    request<CountSuggestion[]>(withQuery("/stock-counts/suggestions", { locationCode, limit })),

  /** `q` matches the SKU or name. */
  listProducts: (params: ListParams) => request<Page<Product>>(withQuery("/products", params)),

  getProduct: (sku: string) => request<ProductDetail>(`/products/${sku}`),

  createProduct: (data: {
    sku: string;
    name: string;
    description?: string;
    lengthCm?: number;
    widthCm?: number;
    heightCm?: number;
    weightKg?: number;
    unitCost: number;
    category?: string;
  }) => request<Product>("/products", { method: "POST", body: JSON.stringify(data) }),

  updateProduct: (
    sku: string,
    data: Partial<{
      name: string;
      description: string;
      lengthCm: number;
      widthCm: number;
      heightCm: number;
      weightKg: number;
      unitCost: number;
      category: string | null;
    }>,
  ) => request<Product>(`/products/${sku}`, { method: "PATCH", body: JSON.stringify(data) }),

  adjustStock: (
    sku: string,
    data: { locationCode: string; quantityDelta: number; reason: string },
  ) =>
    request<StockLevel>(`/products/${sku}/adjustments`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  /** `q` matches the SKU or product name; filter: locationCode. */
  listStockLevels: (params: ListParams) => request<Page<StockLevel>>(withQuery("/stock-levels", params)),

  /** Every stock level — for the per-location chart. */
  allStockLevels: () =>
    fetchAllPages((page, pageSize) => request<Page<StockLevel>>(withQuery("/stock-levels", { page, pageSize }))),

  valuationReport: () => request<ValuationReport>("/valuation"),
};
