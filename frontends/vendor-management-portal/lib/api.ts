const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export type SupplierStatus = "ACTIVE" | "ARCHIVED";

export interface Supplier {
  id: string;
  name: string;
  contactName: string | null;
  email: string;
  phone: string | null;
  address: string | null;
  paymentTermsDays: number;
  status: SupplierStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierProduct {
  id: string;
  supplierId: string;
  sku: string;
  productName: string;
  unitCost: string;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierDeliveryRecord {
  id: string;
  supplierId: string;
  poReference: string;
  expectedDate: string;
  actualDeliveryDate: string;
  onTime: boolean;
  createdAt: string;
}

export interface SupplierDetail extends Supplier {
  products: SupplierProduct[];
  onTimeDeliveryRate: number | null;
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
  listSuppliers: (status?: SupplierStatus) =>
    request<Supplier[]>(`/suppliers${status ? `?status=${status}` : ""}`),

  createSupplier: (data: {
    name: string;
    contactName?: string;
    email: string;
    phone?: string;
    address?: string;
    paymentTermsDays: number;
  }) => request<Supplier>("/suppliers", { method: "POST", body: JSON.stringify(data) }),

  getSupplier: (id: string) => request<SupplierDetail>(`/suppliers/${id}`),

  updateSupplier: (
    id: string,
    data: Partial<{
      name: string;
      contactName: string;
      email: string;
      phone: string;
      address: string;
      paymentTermsDays: number;
    }>,
  ) => request<Supplier>(`/suppliers/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  archiveSupplier: (id: string) =>
    request<Supplier>(`/suppliers/${id}/archive`, { method: "POST" }),

  addProduct: (
    supplierId: string,
    data: { sku: string; productName: string; unitCost: number; currency: string },
  ) =>
    request<SupplierProduct>(`/suppliers/${supplierId}/products`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateProduct: (
    supplierId: string,
    productId: string,
    data: Partial<{ sku: string; productName: string; unitCost: number; currency: string }>,
  ) =>
    request<SupplierProduct>(`/suppliers/${supplierId}/products/${productId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  listDeliveryRecords: (supplierId: string) =>
    request<SupplierDeliveryRecord[]>(`/suppliers/${supplierId}/delivery-records`),

  addDeliveryRecord: (
    supplierId: string,
    data: { poReference: string; expectedDate: string; actualDeliveryDate: string },
  ) =>
    request<SupplierDeliveryRecord>(`/suppliers/${supplierId}/delivery-records`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
