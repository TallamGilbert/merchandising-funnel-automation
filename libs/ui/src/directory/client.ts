import { apiFetch } from "../auth/client";

const DIRECTORY_URL = process.env.NEXT_PUBLIC_DIRECTORY_URL ?? "http://localhost:3009";

export type StaffRole = "OWNER" | "MANAGER" | "BUYER" | "ACCOUNTANT" | "CASHIER" | "WAREHOUSE_STAFF";
export type LocationType = "STORE" | "WAREHOUSE";

export const STAFF_ROLE_LABEL: Record<StaffRole, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  BUYER: "Buyer",
  ACCOUNTANT: "Accountant",
  CASHIER: "Cashier",
  WAREHOUSE_STAFF: "Warehouse staff",
};

export interface StaffMember {
  id: string;
  name: string;
  role: StaffRole;
  locationCode: string | null;
  active: boolean;
  /** Still on a temporary password (new account or reset). */
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Register {
  id: string;
  locationCode: string;
  code: string;
  name: string;
  active: boolean;
}

export interface DirectoryLocation {
  code: string;
  name: string;
  type: LocationType;
  active: boolean;
  registers: Register[];
}

export type DeactivationIssueKind =
  | "STOCK_ON_HAND"
  | "OPEN_BUSINESS_DAYS"
  | "STAFF_ASSIGNED"
  | "TRANSFERS_IN_PROGRESS"
  | "DELIVERIES_IN_PROGRESS"
  | "CHECK_FAILED";

/** Blockers stop a deactivation (Directory enforces them too); warnings only need confirming. */
export interface DeactivationCheck {
  blockers: { kind: DeactivationIssueKind; message: string }[];
  warnings: { kind: DeactivationIssueKind; message: string }[];
}

export interface StaffFilter {
  roles?: StaffRole[];
  locationCode?: string;
  includeInactive?: boolean;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(`${DIRECTORY_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message = Array.isArray(body?.message) ? body.message.join(", ") : (body?.message ?? res.statusText);
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

function query(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter((e): e is [string, string] => Boolean(e[1]));
  return entries.length ? `?${new URLSearchParams(entries).toString()}` : "";
}

export const directoryApi = {
  listStaff: (filter: StaffFilter = {}) =>
    request<StaffMember[]>(
      `/staff${query({
        role: filter.roles?.join(","),
        locationCode: filter.locationCode,
        includeInactive: filter.includeInactive ? "true" : undefined,
      })}`,
    ),

  /** Returns a temporary password to hand over once — the person must change it on first sign-in. */
  createStaff: (data: { id: string; name: string; role: StaffRole; locationCode?: string }) =>
    request<StaffMember & { temporaryPassword: string }>("/staff", { method: "POST", body: JSON.stringify(data) }),

  resetPassword: (id: string) =>
    request<{ id: string; temporaryPassword: string }>(`/staff/${encodeURIComponent(id)}/reset-password`, {
      method: "POST",
    }),

  updateStaff: (
    id: string,
    data: Partial<{ name: string; role: StaffRole; locationCode: string | null; active: boolean }>,
  ) => request<StaffMember>(`/staff/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(data) }),

  listLocations: (type?: LocationType, includeInactive = false) =>
    request<DirectoryLocation[]>(`/locations${query({ type, includeInactive: includeInactive ? "true" : undefined })}`),

  /** The code is permanent — every other service records it. */
  createLocation: (data: { code: string; name: string; type: LocationType }) =>
    request<Omit<DirectoryLocation, "registers">>("/locations", { method: "POST", body: JSON.stringify(data) }),

  deactivationCheck: (code: string) =>
    request<DeactivationCheck>(`/locations/${encodeURIComponent(code)}/deactivation-check`),

  /** No delete: other services reference the code, so a closed location is deactivated instead. */
  updateLocation: (code: string, data: Partial<{ name: string; active: boolean }>) =>
    request<Omit<DirectoryLocation, "registers">>(`/locations/${encodeURIComponent(code)}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  addRegister: (locationCode: string, data: { code: string; name: string }) =>
    request<Register>(`/locations/${encodeURIComponent(locationCode)}/registers`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
