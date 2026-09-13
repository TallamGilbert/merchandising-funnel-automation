/**
 * Module <-> delivery-phase mapping, mirrored from PRD Section 7. Every
 * service and frontend gates itself using this table plus the generic
 * env-var reader in `feature-flags.ts` — nothing here talks to the network
 * or a database.
 */
export const ModuleKey = {
  VENDOR_MANAGEMENT: "vendor-management",
  PROCUREMENT: "procurement",
  INVENTORY: "inventory",
  RECEIVING: "receiving",
  WAREHOUSE_OPERATIONS: "warehouse-operations",
  RETAIL_SALES: "retail-sales",
  SALES_AUDIT: "sales-audit",
  FINANCIALS: "financials",
} as const;

export type ModuleKey = (typeof ModuleKey)[keyof typeof ModuleKey];

export const MODULE_PHASE: Record<ModuleKey, 1 | 2 | 3 | 4> = {
  [ModuleKey.VENDOR_MANAGEMENT]: 1,
  [ModuleKey.PROCUREMENT]: 1,
  [ModuleKey.INVENTORY]: 1,
  [ModuleKey.RECEIVING]: 2,
  [ModuleKey.WAREHOUSE_OPERATIONS]: 2,
  [ModuleKey.RETAIL_SALES]: 3,
  [ModuleKey.SALES_AUDIT]: 3,
  [ModuleKey.FINANCIALS]: 4,
};

export const MODULE_FEATURE_ENV_VAR: Record<ModuleKey, string> = {
  [ModuleKey.VENDOR_MANAGEMENT]: "FEATURE_VENDOR_MANAGEMENT_ENABLED",
  [ModuleKey.PROCUREMENT]: "FEATURE_PROCUREMENT_ENABLED",
  [ModuleKey.INVENTORY]: "FEATURE_INVENTORY_ENABLED",
  [ModuleKey.RECEIVING]: "FEATURE_RECEIVING_ENABLED",
  [ModuleKey.WAREHOUSE_OPERATIONS]: "FEATURE_WAREHOUSE_OPERATIONS_ENABLED",
  [ModuleKey.RETAIL_SALES]: "FEATURE_RETAIL_SALES_ENABLED",
  [ModuleKey.SALES_AUDIT]: "FEATURE_SALES_AUDIT_ENABLED",
  [ModuleKey.FINANCIALS]: "FEATURE_FINANCIALS_ENABLED",
};

const PHASE_1_MODULES: ReadonlySet<ModuleKey> = new Set([
  ModuleKey.VENDOR_MANAGEMENT,
  ModuleKey.PROCUREMENT,
  ModuleKey.INVENTORY,
]);

/** Phase 1 modules default to enabled; every later-phase module defaults to disabled until explicitly flagged on. */
export function defaultEnabledFor(moduleKey: ModuleKey): boolean {
  return PHASE_1_MODULES.has(moduleKey);
}
