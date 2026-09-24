import { Inject, Injectable, Logger, OnModuleInit, ServiceUnavailableException } from "@nestjs/common";
import { ClientGrpc } from "@nestjs/microservices";
import { firstValueFrom, Observable } from "rxjs";
import {
  INVENTORY_GRPC_SERVICE,
  ReleaseReservationRequest,
  ReleaseReservationResponse,
  StockCheckRequest,
  StockCheckResponse,
} from "@mms/shared";

interface InventoryStockGrpcService {
  checkAndReserveStock(request: StockCheckRequest): Observable<StockCheckResponse>;
  releaseReservation(request: ReleaseReservationRequest): Observable<ReleaseReservationResponse>;
}

/**
 * gRPC client for the one latency-sensitive sync path in the system
 * (FR-6.2, NFR-5): checking and reserving stock with Inventory at checkout.
 * Method/field names must match contracts/proto/inventory.proto exactly —
 * see services/inventory/src/grpc/inventory-stock.grpc-controller.ts for
 * the server side of this same contract.
 */
@Injectable()
export class InventoryGrpcClientService implements OnModuleInit {
  private readonly logger = new Logger(InventoryGrpcClientService.name);
  private stock!: InventoryStockGrpcService;

  constructor(@Inject(INVENTORY_GRPC_SERVICE) private readonly client: ClientGrpc) {}

  onModuleInit() {
    this.stock = this.client.getService<InventoryStockGrpcService>(INVENTORY_GRPC_SERVICE);
  }

  async checkAndReserveStock(request: StockCheckRequest): Promise<StockCheckResponse> {
    try {
      return await firstValueFrom(this.stock.checkAndReserveStock(request));
    } catch (error) {
      this.logger.error(`Inventory gRPC unreachable: ${(error as Error).message}`);
      throw new ServiceUnavailableException(
        "Inventory is unreachable — cannot validate stock right now.",
      );
    }
  }

  async releaseReservation(reservationId: string): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.stock.releaseReservation({ reservationId }),
      );
      return response.released;
    } catch (error) {
      this.logger.error(`Inventory gRPC unreachable: ${(error as Error).message}`);
      throw new ServiceUnavailableException(
        "Inventory is unreachable — cannot release this reservation right now.",
      );
    }
  }
}
