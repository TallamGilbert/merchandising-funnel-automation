import { Controller } from "@nestjs/common";
import { GrpcMethod } from "@nestjs/microservices";
import {
  INVENTORY_GRPC_SERVICE,
  ReleaseReservationRequest,
  ReleaseReservationResponse,
  StockCheckRequest,
  StockCheckResponse,
} from "@mms/shared";
import { StockService } from "../stock/stock.service";

/**
 * gRPC server for the one latency-sensitive sync path in the system
 * (FR-4.5, FR-6.2, NFR-5). Method names must match
 * contracts/proto/inventory.proto's `InventoryStock` service exactly —
 * NestJS loads the .proto at runtime (no codegen step) and dispatches by
 * name via @GrpcMethod.
 */
@Controller()
export class InventoryGrpcController {
  constructor(private readonly stock: StockService) {}

  @GrpcMethod(INVENTORY_GRPC_SERVICE, "CheckAndReserveStock")
  async checkAndReserveStock(
    request: StockCheckRequest,
  ): Promise<StockCheckResponse> {
    return this.stock.reserve(
      request.sku,
      request.locationCode,
      request.quantityRequested,
      request.transactionReference,
    );
  }

  @GrpcMethod(INVENTORY_GRPC_SERVICE, "ReleaseReservation")
  async releaseReservation(
    request: ReleaseReservationRequest,
  ): Promise<ReleaseReservationResponse> {
    const released = await this.stock.releaseReservation(request.reservationId);
    return { released };
  }
}
