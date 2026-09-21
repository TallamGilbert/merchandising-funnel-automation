import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/**
 * The slice of an Inventory product that Warehouse Operations is allowed to
 * know (FR-4.7): physical attributes and sales velocity. Inventory's response
 * also carries unit cost and stock counts; `getItemAttributes` drops them —
 * Warehouse Ops never tracks overall quantity or value.
 */
export interface ItemAttributes {
  sku: string;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  weightKg: number | null;
  unitsPerDay: number | null;
}

interface InventoryProductResponse {
  sku: string;
  lengthCm: string | number | null;
  widthCm: string | number | null;
  heightCm: string | number | null;
  weightKg: string | number | null;
  salesVelocity: { unitsPerDay: string | number } | null;
}

const toNumberOrNull = (value: string | number | null | undefined) =>
  value === null || value === undefined ? null : Number(value);

/**
 * Server-to-server REST client for FR-4.7 (read item attributes/velocity) and
 * FR-5.7 (confirm final bin location). Plain `fetch` (Node 20 global),
 * matching the other services' clients.
 */
@Injectable()
export class InventoryClientService {
  private readonly logger = new Logger(InventoryClientService.name);
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl =
      this.config.get<string>("INVENTORY_URL") ?? "http://localhost:3003";
  }

  async getItemAttributes(sku: string): Promise<ItemAttributes> {
    const url = `${this.baseUrl}/products/${encodeURIComponent(sku)}`;
    const response = await this.request(url);

    if (response.status === 404) {
      throw new NotFoundException(`Inventory has no product ${sku}`);
    }
    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Inventory returned ${response.status} for SKU ${sku}`,
      );
    }

    const product = (await response.json()) as InventoryProductResponse;
    return {
      sku: product.sku,
      lengthCm: toNumberOrNull(product.lengthCm),
      widthCm: toNumberOrNull(product.widthCm),
      heightCm: toNumberOrNull(product.heightCm),
      weightKg: toNumberOrNull(product.weightKg),
      unitsPerDay: toNumberOrNull(product.salesVelocity?.unitsPerDay),
    };
  }

  /**
   * FR-5.7 — tells Inventory how many units of a SKU sit in a bin. Sends the
   * bin's absolute quantity (a PUT), not a delta, so a retry after a partial
   * failure cannot double-count.
   */
  async confirmBinLocation(
    sku: string,
    binCode: string,
    body: { locationCode: string; quantity: number },
  ): Promise<void> {
    const url = `${this.baseUrl}/products/${encodeURIComponent(sku)}/bin-locations/${encodeURIComponent(binCode)}`;
    const response = await this.request(url, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    if (response.status === 404) {
      throw new NotFoundException(`Inventory has no product ${sku}`);
    }
    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Inventory returned ${response.status} confirming bin ${binCode} for SKU ${sku}`,
      );
    }
  }

  private async request(url: string, init?: RequestInit): Promise<Response> {
    try {
      return await fetch(url, init);
    } catch (error) {
      this.logger.error(`Inventory unreachable at ${url}: ${(error as Error).message}`);
      throw new ServiceUnavailableException(
        "Inventory is unreachable right now.",
      );
    }
  }
}
