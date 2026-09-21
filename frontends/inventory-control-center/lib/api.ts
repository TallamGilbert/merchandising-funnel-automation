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
  createdAt: string;
  updatedAt: string;
}

export interface StockLevel {
  id: string;
  productId: string;
  sku?: string;
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
  listProducts: () => request<Product[]>("/products"),

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

  listStockLevels: (locationCode?: string) =>
    request<StockLevel[]>(`/stock-levels${locationCode ? `?locationCode=${locationCode}` : ""}`),

  valuationReport: () => request<ValuationReport>("/valuation"),
};
