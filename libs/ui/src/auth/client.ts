import type { StaffRole } from "../directory/client";

const DIRECTORY_URL = process.env.NEXT_PUBLIC_DIRECTORY_URL ?? "http://localhost:3009";

/** Fired on any 401 from an MMS API, so the AuthProvider can show the sign-in screen. */
export const UNAUTHORIZED_EVENT = "mms:unauthorized";

export interface SessionUser {
  id: string;
  name: string;
  role: StaffRole;
  locationCode: string | null;
  mustChangePassword: boolean;
}

/**
 * `fetch` for every MMS API call: sends the session cookie (one cookie for
 * all apps and APIs, set by Directory on sign-in) and reports a 401 so the
 * app drops back to the sign-in screen instead of showing a raw error.
 */
export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, { ...init, credentials: "include" });
  if (res.status === 401 && typeof window !== "undefined") {
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  }
  return res;
}

export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  // Plain fetch, not apiFetch: a 401 here is an answer, not a signal.
  const res = await fetch(`${DIRECTORY_URL}${path}`, {
    method,
    credentials: "include",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const message = Array.isArray(data?.message) ? data.message.join(", ") : (data?.message ?? res.statusText);
    throw new AuthError(message, res.status);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export const authApi = {
  login: (staffId: string, password: string) => call<SessionUser>("POST", "/auth/login", { staffId, password }),
  logout: () => call<void>("POST", "/auth/logout"),
  me: () => call<SessionUser>("GET", "/auth/me"),
  changePassword: (currentPassword: string, newPassword: string) =>
    call<SessionUser>("POST", "/auth/change-password", { currentPassword, newPassword }),
};
