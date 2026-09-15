import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface SupplierOfferForSku {
  supplierId: string;
  supplierName: string;
  sku: string;
  productName: string;
  unitCost: number;
  currency: string;
  paymentTermsDays: number;
}

/**
 * Server-to-server REST client for FR-2.1/FR-2.2: Procurement calls Vendor
 * Management to price a PO and freeze payment terms at creation time. Plain
 * `fetch` (Node 20 global) rather than a heavier HTTP client — this is the
 * only outbound call this service makes.
 */
@Injectable()
export class VendorManagementClientService {
  private readonly logger = new Logger(VendorManagementClientService.name);
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl =
      this.config.get<string>("VENDOR_MANAGEMENT_URL") ??
      "http://localhost:3001";
  }

  async findSuppliersForSku(sku: string): Promise<SupplierOfferForSku[]> {
    const url = `${this.baseUrl}/suppliers/by-sku/${encodeURIComponent(sku)}`;
    let response: Response;
    try {
      response = await fetch(url);
    } catch (error) {
      this.logger.error(`Vendor Management unreachable at ${url}: ${(error as Error).message}`);
      throw new ServiceUnavailableException(
        "Vendor Management is unreachable — cannot price this PO right now.",
      );
    }

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Vendor Management returned ${response.status} for SKU ${sku}`,
      );
    }

    return (await response.json()) as SupplierOfferForSku[];
  }
}
