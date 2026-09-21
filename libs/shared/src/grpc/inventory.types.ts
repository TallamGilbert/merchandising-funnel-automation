import { join } from "path";

/**
 * Hand-written TypeScript shapes mirroring `contracts/proto/inventory.proto`
 * message-for-message. NestJS's gRPC transport (`Transport.GRPC`) loads the
 * `.proto` file directly at runtime via `@grpc/proto-loader` — no codegen
 * step is required for the service to run. These types exist purely so
 * Inventory's server handler and Retail Sales' client call are compile-time
 * type-safe on both ends of the one contract.
 *
 * `scripts/generate-proto.sh` (ts-proto) is available for teams that want
 * fuller generated bindings; it is optional, not load-bearing.
 */
export interface StockCheckRequest {
  sku: string;
  locationCode: string;
  quantityRequested: number;
  transactionReference: string;
}

export interface StockCheckResponse {
  available: boolean;
  quantityReserved: number;
  availableQuantityAfterReservation: number;
  reservationId: string;
}

export interface ReleaseReservationRequest {
  reservationId: string;
}

export interface ReleaseReservationResponse {
  released: boolean;
}

export const INVENTORY_GRPC_PACKAGE = "mms.inventory.v1";
export const INVENTORY_GRPC_SERVICE = "InventoryStock";

/** Resolves to contracts/proto/inventory.proto from anywhere in the monorepo. */
export function inventoryProtoPath(): string {
  return join(__dirname, "..", "..", "..", "..", "contracts", "proto", "inventory.proto");
}
