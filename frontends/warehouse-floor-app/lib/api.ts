const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3005";

export type PutawayTaskStatus = "PENDING" | "COMPLETED";
export type TransferStatus = "PICKING" | "COMPLETED";
export type PickTaskStatus = "PENDING" | "PICKED";

export interface BinStock {
  sku: string;
  quantity: number;
}

// Prisma Decimals arrive as strings over JSON.
export interface Bin {
  id: string;
  code: string;
  locationCode: string;
  zone: string;
  pickPriority: number;
  capacityVolumeCm3: string;
  maxWeightKg: string;
  usedVolumeCm3: string;
  usedWeightKg: string;
  stock?: BinStock[];
}

export interface ZoneUtilization {
  locationCode: string;
  zone: string;
  binCount: number;
  capacityVolumeCm3: number;
  usedVolumeCm3: number;
  volumeUtilizationPct: number;
  maxWeightKg: number;
  usedWeightKg: number;
  weightUtilizationPct: number;
}

export interface PutawayTask {
  id: string;
  goodsReceivedNoteNumber: string;
  poNumber: string;
  sku: string;
  productName: string;
  quantity: number;
  locationCode: string;
  status: PutawayTaskStatus;
  bin: Bin | null;
  completedById: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface PickTask {
  id: string;
  transferId: string;
  sku: string;
  quantity: number;
  status: PickTaskStatus;
  bin: Bin;
  pickedById: string | null;
  pickedAt: string | null;
}

export interface Transfer {
  id: string;
  transferNumber: string;
  sku: string;
  quantity: number;
  fromLocationCode: string;
  toLocationCode: string;
  status: TransferStatus;
  requestedById: string;
  completedAt: string | null;
  createdAt: string;
  picks: PickTask[];
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
  listPutawayTasks: (status?: PutawayTaskStatus) =>
    request<PutawayTask[]>(`/putaway-tasks${status ? `?status=${status}` : ""}`),

  assignBin: (id: string, binCode?: string) =>
    request<PutawayTask>(`/putaway-tasks/${id}/assign`, {
      method: "POST",
      body: JSON.stringify(binCode ? { binCode } : {}),
    }),

  completePutaway: (id: string, data: { completedById: string; scannedBinCode: string }) =>
    request<PutawayTask>(`/putaway-tasks/${id}/complete`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listTransfers: (status?: TransferStatus) =>
    request<Transfer[]>(`/transfers${status ? `?status=${status}` : ""}`),

  getTransfer: (id: string) => request<Transfer>(`/transfers/${id}`),

  createTransfer: (data: {
    sku: string;
    quantity: number;
    fromLocationCode: string;
    toLocationCode: string;
    requestedById: string;
  }) => request<Transfer>("/transfers", { method: "POST", body: JSON.stringify(data) }),

  completePick: (id: string, data: { pickedById: string; scannedBinCode: string }) =>
    request<Transfer>(`/pick-tasks/${id}/complete`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listBins: (locationCode?: string) =>
    request<Bin[]>(`/bins${locationCode ? `?locationCode=${locationCode}` : ""}`),

  createBin: (data: {
    code: string;
    locationCode: string;
    zone: string;
    pickPriority?: number;
    capacityVolumeCm3: number;
    maxWeightKg: number;
  }) => request<Bin>("/bins", { method: "POST", body: JSON.stringify(data) }),

  getUtilization: (locationCode?: string) =>
    request<ZoneUtilization[]>(
      `/bins/utilization${locationCode ? `?locationCode=${locationCode}` : ""}`,
    ),
};
