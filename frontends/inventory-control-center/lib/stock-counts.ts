import type { StockCountStatus } from "./api";

export const STATUS_LABEL: Record<StockCountStatus, string> = {
  OPEN: "Counting",
  SUBMITTED: "Awaiting review",
  POSTED: "Posted",
  CANCELLED: "Cancelled",
};

export const STATUS_BADGE: Record<StockCountStatus, string> = {
  OPEN: "badge",
  SUBMITTED: "badge warn",
  POSTED: "badge ok",
  CANCELLED: "badge",
};

/** Starting, posting and cancelling counts is for managers (D-19); anyone here can count. */
export function canManageCounts(role: string): boolean {
  return role === "OWNER" || role === "MANAGER";
}

/** Recording counts and submitting them — buyers can browse but not count. */
export function canCount(role: string): boolean {
  return canManageCounts(role) || role === "WAREHOUSE_STAFF";
}
