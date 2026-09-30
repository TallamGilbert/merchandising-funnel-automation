/**
 * Read-only access to every module's public REST API. The dashboard never
 * writes; each tab links to the module's own app for that. Types cover only
 * the fields shown here (Prisma Decimals arrive as strings).
 */
const url = {
  vendorManagement: process.env.NEXT_PUBLIC_VENDOR_MANAGEMENT_URL ?? "http://localhost:3001",
  procurement: process.env.NEXT_PUBLIC_PROCUREMENT_URL ?? "http://localhost:3002",
  inventory: process.env.NEXT_PUBLIC_INVENTORY_URL ?? "http://localhost:3003",
  receiving: process.env.NEXT_PUBLIC_RECEIVING_URL ?? "http://localhost:3004",
  warehouse: process.env.NEXT_PUBLIC_WAREHOUSE_OPERATIONS_URL ?? "http://localhost:3005",
  retailSales: process.env.NEXT_PUBLIC_RETAIL_SALES_URL ?? "http://localhost:3006",
  salesAudit: process.env.NEXT_PUBLIC_SALES_AUDIT_URL ?? "http://localhost:3007",
  financials: process.env.NEXT_PUBLIC_FINANCIALS_URL ?? "http://localhost:3008",
};

export const APP_URL = {
  vendorManagement: process.env.NEXT_PUBLIC_VENDOR_MANAGEMENT_APP_URL ?? "http://localhost:3101",
  procurement: process.env.NEXT_PUBLIC_PROCUREMENT_APP_URL ?? "http://localhost:3102",
  inventory: process.env.NEXT_PUBLIC_INVENTORY_APP_URL ?? "http://localhost:3103",
  receiving: process.env.NEXT_PUBLIC_RECEIVING_APP_URL ?? "http://localhost:3104",
  warehouse: process.env.NEXT_PUBLIC_WAREHOUSE_APP_URL ?? "http://localhost:3105",
  pos: process.env.NEXT_PUBLIC_POS_APP_URL ?? "http://localhost:3106",
  storeManager: process.env.NEXT_PUBLIC_STORE_MANAGER_APP_URL ?? "http://localhost:3107",
  finance: process.env.NEXT_PUBLIC_FINANCE_APP_URL ?? "http://localhost:3108",
};

async function get<T>(base: string, path: string): Promise<T> {
  const res = await fetch(`${base}${path}`);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? `${res.status} ${res.statusText}`);
  }
  // Some endpoints answer "nothing yet" with an empty 200 body.
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

// ---- Retail Sales -------------------------------------------------------

export interface SalesSummary {
  storeId: string;
  daily: { date: string; sales: number; returns: number; transactions: number }[];
  paymentMix: { method: string; amount: number }[];
  topProducts: { sku: string; productName: string; quantity: number; revenue: number }[];
}

// ---- Inventory ----------------------------------------------------------

export interface Valuation {
  asOf: string;
  totalValue: number;
  byProduct: { sku: string; productName: string; onHand: number; unitCost: number; totalValue: number }[];
}

export interface StockLevel {
  sku?: string;
  locationCode: string;
  onHand: number;
  available: number;
}

// ---- Procurement --------------------------------------------------------

export type PoStatus = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "SENT" | "PARTIALLY_RECEIVED" | "CLOSED";

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  status: PoStatus;
  currency: string;
  totalAmount: string;
  createdAt: string;
}

export interface ReorderSuggestion {
  id: string;
  sku: string;
  reason: string;
  status: "NEW" | "DISMISSED" | "CONVERTED";
  createdAt: string;
}

// ---- Receiving / Warehouse ----------------------------------------------

export interface ExpectedDelivery {
  id: string;
  poNumber: string;
  supplierName: string;
  status: "EXPECTED" | "PARTIALLY_RECEIVED" | "RECEIVED";
  createdAt: string;
  lines: { quantityOrdered: number; quantityReceived: number }[];
}

export interface GoodsReceivedNote {
  id: string;
  goodsReceivedNoteNumber: string;
  poNumber: string;
  status: "DRAFT" | "FINALIZED";
  finalizedAt: string | null;
  createdAt: string;
  lines: { discrepancyType: "NONE" | "SHORTAGE" | "OVERAGE" | "DAMAGE" }[];
}

export interface PutawayTask {
  id: string;
  sku: string;
  productName: string;
  quantity: number;
  locationCode: string;
  createdAt: string;
}

export interface Transfer {
  id: string;
  transferNumber: string;
  sku: string;
  quantity: number;
  fromLocationCode: string;
  toLocationCode: string;
  status: "PICKING" | "COMPLETED";
  createdAt: string;
}

export interface ZoneUtilization {
  locationCode: string;
  zone: string;
  binCount: number;
  volumeUtilizationPct: number;
  weightUtilizationPct: number;
}

// ---- Vendor management --------------------------------------------------

export interface Supplier {
  id: string;
  name: string;
  status: "ACTIVE" | "ARCHIVED";
  paymentTermsDays: number;
}

export interface SupplierDetail extends Supplier {
  onTimeDeliveryRate: number | null;
  products: unknown[];
}

// ---- Sales Audit --------------------------------------------------------

export interface DailyClose {
  storeId: string;
  businessDate: string;
  expectedTotal: string;
  actualCountedTotal: string | null;
  discrepancyAmount: string | null;
  discrepancyExplanation: string | null;
  status: "OPEN" | "BLOCKED_ON_EXPLANATION" | "CLOSED";
  closedByManagerId: string | null;
  closedAt: string | null;
}

export interface StoreDayLedger {
  expectedTotal: string;
  cashierLines: { cashierId: string; registerId: string; expectedAmount: string }[];
}

// ---- Financials ---------------------------------------------------------

export interface FinanceSummary {
  revenue: number;
  cogs: number;
  grossProfit: number;
  marginPct: number | null;
  cashOverShort: number;
  payables: { outstanding: number; openBills: number; overdue: number; overdueBills: number };
  inbox: { pending: number; needsAttention: number };
  daily: { date: string; revenue: number; cogs: number; grossProfit: number }[];
}

export interface AgingReport {
  buckets: ("current" | "1-30" | "31-60" | "61-90" | "90+")[];
  totals: Record<string, number>;
  suppliers: { supplierId: string; supplierName: string; total: number }[];
  totalOutstanding: number;
}

const enc = encodeURIComponent;

export const services = {
  salesSummary: (storeId: string, from: string, to: string) =>
    get<SalesSummary>(url.retailSales, `/stores/${enc(storeId)}/sales-summary?from=${from}&to=${to}`),

  valuation: () => get<Valuation>(url.inventory, "/valuation"),
  stockLevels: () => get<StockLevel[]>(url.inventory, "/stock-levels"),

  purchaseOrders: () => get<PurchaseOrder[]>(url.procurement, "/purchase-orders"),
  reorderSuggestions: () => get<ReorderSuggestion[]>(url.procurement, "/reorder-suggestions?status=NEW"),

  expectedDeliveries: () => get<ExpectedDelivery[]>(url.receiving, "/expected-deliveries"),
  goodsReceivedNotes: () => get<GoodsReceivedNote[]>(url.receiving, "/goods-received-notes"),

  pendingPutaways: () => get<PutawayTask[]>(url.warehouse, "/putaway-tasks?status=PENDING"),
  transfersPicking: () => get<Transfer[]>(url.warehouse, "/transfers?status=PICKING"),
  utilization: () => get<ZoneUtilization[]>(url.warehouse, "/bins/utilization"),

  suppliers: () =>
    get<{ items: Supplier[] }>(url.vendorManagement, "/suppliers?status=ACTIVE&pageSize=100").then((r) => r.items),
  supplier: (id: string) => get<SupplierDetail>(url.vendorManagement, `/suppliers/${enc(id)}`),

  dailyClose: (storeId: string, businessDate: string) =>
    get<DailyClose | null>(url.salesAudit, `/stores/${enc(storeId)}/daily-close?businessDate=${businessDate}`),
  storeLedger: (storeId: string, businessDate: string) =>
    get<StoreDayLedger | null>(url.salesAudit, `/stores/${enc(storeId)}/ledger?businessDate=${businessDate}`),

  financeSummary: (from: string, to: string) => get<FinanceSummary>(url.financials, `/reports/summary?from=${from}&to=${to}`),
  aging: () => get<AgingReport>(url.financials, "/payables/aging"),
};
