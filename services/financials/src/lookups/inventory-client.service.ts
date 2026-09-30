import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { getJson } from "./http";

/**
 * FR-8.2: ItemSold carries selling prices only, so cost of goods sold is
 * the product's unit cost in Inventory at the time the sale is posted.
 */
@Injectable()
export class InventoryClientService {
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.baseUrl = config.get<string>("INVENTORY_URL") ?? "http://localhost:3003";
  }

  async getUnitCost(sku: string): Promise<number> {
    const product = await getJson<{ unitCost: string }>(
      `${this.baseUrl}/products/${encodeURIComponent(sku)}`,
      `Product ${sku} in Inventory`,
    );
    return Number(product.unitCost);
  }
}
