import { LocationType, StaffRole } from "../generated/prisma";

/**
 * Demo directory for a fresh environment. Codes and ids match the ones the
 * other services' demo flows already record (WH-MAIN, DOCK-1, STORE-1,
 * REG-1, cashier-amy, buyer-jane, mgr-sam, sup-grace, picker-lucy,
 * fork-amos, dock-james), so existing records line up with real names.
 */
export const DEMO_DIRECTORY = {
  locations: [
    { code: "WH-MAIN", name: "Main Warehouse (Industrial Area)", type: LocationType.WAREHOUSE },
    { code: "DOCK-1", name: "Receiving Dock 1", type: LocationType.WAREHOUSE },
    { code: "STORE-1", name: "Westlands Showroom", type: LocationType.STORE },
    { code: "STORE-2", name: "CBD Showroom", type: LocationType.STORE },
  ],
  registers: [
    { locationCode: "STORE-1", code: "REG-1", name: "Till 1 (front)" },
    { locationCode: "STORE-1", code: "REG-2", name: "Till 2 (back)" },
    { locationCode: "STORE-2", code: "REG-1", name: "Till 1" },
  ],
  staff: [
    { id: "owner-wanjiku", name: "Wanjiku Mwangi", role: StaffRole.OWNER, locationCode: null },
    { id: "mgr-sam", name: "Sam Otieno", role: StaffRole.MANAGER, locationCode: "WH-MAIN" },
    { id: "buyer-jane", name: "Jane Akinyi", role: StaffRole.MANAGER, locationCode: "WH-MAIN" },
    { id: "sup-grace", name: "Grace Chebet", role: StaffRole.MANAGER, locationCode: "WH-MAIN" },
    { id: "mgr-james", name: "James Kariuki", role: StaffRole.MANAGER, locationCode: "STORE-1" },
    { id: "mgr-faith", name: "Faith Njeri", role: StaffRole.MANAGER, locationCode: "STORE-2" },
    { id: "cashier-amy", name: "Amy Wanjiru", role: StaffRole.CASHIER, locationCode: "STORE-1" },
    { id: "cashier-brian", name: "Brian Kiptoo", role: StaffRole.CASHIER, locationCode: "STORE-1" },
    { id: "cashier-cynthia", name: "Cynthia Achieng", role: StaffRole.CASHIER, locationCode: "STORE-2" },
    { id: "picker-lucy", name: "Lucy Muthoni", role: StaffRole.WAREHOUSE_STAFF, locationCode: "WH-MAIN" },
    { id: "fork-amos", name: "Amos Kipchumba", role: StaffRole.WAREHOUSE_STAFF, locationCode: "WH-MAIN" },
    { id: "dock-james", name: "James Ouma", role: StaffRole.WAREHOUSE_STAFF, locationCode: "DOCK-1" },
  ],
};

export type DemoDirectory = typeof DEMO_DIRECTORY;
