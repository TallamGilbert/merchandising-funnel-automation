import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { internalFetch } from "@mms/shared";

/**
 * Server-to-server REST reads of what other modules still have going on at a
 * location, for the deactivation check. Each call throws when its service is
 * unreachable or errors; the caller decides whether that blocks or only warns.
 */
@Injectable()
export class LocationActivityClient {
  private readonly logger = new Logger(LocationActivityClient.name);
  private readonly urls: Record<"inventory" | "salesAudit" | "warehouseOperations" | "receiving", string>;

  constructor(config: ConfigService) {
    this.urls = {
      inventory: config.get<string>("INVENTORY_URL") ?? "http://localhost:3003",
      salesAudit: config.get<string>("SALES_AUDIT_URL") ?? "http://localhost:3007",
      warehouseOperations: config.get<string>("WAREHOUSE_OPERATIONS_URL") ?? "http://localhost:3005",
      receiving: config.get<string>("RECEIVING_URL") ?? "http://localhost:3004",
    };
  }

  async stockOnHand(locationCode: string): Promise<{ skusOnHand: number; unitsOnHand: number }> {
    return this.get(`${this.urls.inventory}/stock-levels/summary?locationCode=${encodeURIComponent(locationCode)}`);
  }

  async unclosedBusinessDates(storeId: string): Promise<string[]> {
    const body = await this.get<{ businessDates: string[] }>(
      `${this.urls.salesAudit}/stores/${encodeURIComponent(storeId)}/open-days`,
    );
    return body.businessDates;
  }

  async transfersInProgress(locationCode: string): Promise<number> {
    return this.total(
      `${this.urls.warehouseOperations}/transfers?status=PICKING&locationCode=${encodeURIComponent(locationCode)}&pageSize=1`,
    );
  }

  async draftGoodsReceivedNotes(locationCode: string): Promise<number> {
    return this.total(
      `${this.urls.receiving}/goods-received-notes?status=DRAFT&locationCode=${encodeURIComponent(locationCode)}&pageSize=1`,
    );
  }

  private async total(url: string): Promise<number> {
    return (await this.get<{ total: number }>(url)).total;
  }

  private async get<T>(url: string): Promise<T> {
    let response: Response;
    try {
      response = await internalFetch(url);
    } catch (error) {
      this.logger.error(`Unreachable at ${url}: ${(error as Error).message}`);
      throw error;
    }
    if (!response.ok) {
      this.logger.error(`${url} returned ${response.status}`);
      throw new Error(`returned ${response.status}`);
    }
    return (await response.json()) as T;
  }
}
