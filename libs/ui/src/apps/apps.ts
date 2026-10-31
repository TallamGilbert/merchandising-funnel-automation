import type { StaffRole } from "../directory/client";

/**
 * Every MMS app: its name, where it is deployed, and which roles may use it.
 * Each app's AuthGate reads `allow` from here, so the app switcher never
 * offers an app that would turn the person away. Production URLs are written
 * by deploy/frontend-env.sh; NEXT_PUBLIC_* values must stay literal so Next
 * can inline them at build time.
 */
export type MmsAppId =
  | "dashboard"
  | "vendors"
  | "procurement"
  | "inventory"
  | "receiving"
  | "warehouse"
  | "pos"
  | "stores"
  | "finance";

export interface MmsApp {
  id: MmsAppId;
  name: string;
  url: string;
  allow: StaffRole[];
}

export const MMS_APPS: Record<MmsAppId, MmsApp> = {
  dashboard: {
    id: "dashboard",
    name: "Executive Dashboard",
    url: process.env.NEXT_PUBLIC_EXECUTIVE_DASHBOARD_APP_URL ?? "http://localhost:3109",
    allow: ["OWNER", "MANAGER"],
  },
  vendors: {
    id: "vendors",
    name: "Vendor Management Portal",
    url: process.env.NEXT_PUBLIC_VENDOR_MANAGEMENT_APP_URL ?? "http://localhost:3101",
    allow: ["OWNER", "MANAGER", "BUYER"],
  },
  procurement: {
    id: "procurement",
    name: "Procurement Dashboard",
    url: process.env.NEXT_PUBLIC_PROCUREMENT_APP_URL ?? "http://localhost:3102",
    allow: ["OWNER", "MANAGER", "BUYER"],
  },
  inventory: {
    id: "inventory",
    name: "Inventory Control Center",
    url: process.env.NEXT_PUBLIC_INVENTORY_APP_URL ?? "http://localhost:3103",
    allow: ["OWNER", "MANAGER", "BUYER", "WAREHOUSE_STAFF"],
  },
  receiving: {
    id: "receiving",
    name: "Warehouse Receiving App",
    url: process.env.NEXT_PUBLIC_RECEIVING_APP_URL ?? "http://localhost:3104",
    allow: ["OWNER", "MANAGER", "WAREHOUSE_STAFF"],
  },
  warehouse: {
    id: "warehouse",
    name: "Warehouse Floor App",
    url: process.env.NEXT_PUBLIC_WAREHOUSE_APP_URL ?? "http://localhost:3105",
    allow: ["OWNER", "MANAGER", "WAREHOUSE_STAFF"],
  },
  pos: {
    id: "pos",
    name: "Point of Sale Terminal",
    url: process.env.NEXT_PUBLIC_POS_APP_URL ?? "http://localhost:3106",
    allow: ["OWNER", "MANAGER", "CASHIER"],
  },
  stores: {
    id: "stores",
    name: "Store Manager Dashboard",
    url: process.env.NEXT_PUBLIC_STORE_MANAGER_APP_URL ?? "http://localhost:3107",
    allow: ["OWNER", "MANAGER"],
  },
  finance: {
    id: "finance",
    name: "Finance Portal",
    url: process.env.NEXT_PUBLIC_FINANCE_APP_URL ?? "http://localhost:3108",
    allow: ["OWNER", "MANAGER", "ACCOUNTANT"],
  },
};

/** The apps a role may open, in menu order. */
export function appsFor(role: StaffRole): MmsApp[] {
  return Object.values(MMS_APPS).filter((app) => app.allow.includes(role));
}

/** The app served from `origin` (e.g. window.location.origin), if any. */
export function appAt(origin: string): MmsApp | undefined {
  return Object.values(MMS_APPS).find((app) => new URL(app.url).origin === origin);
}
