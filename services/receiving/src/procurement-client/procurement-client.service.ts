import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/**
 * The slice of a Procurement PO that Receiving is allowed to know. Procurement
 * also returns unit costs, totals and payment terms; this type — and the
 * mapping in `findOpenPo` — deliberately drops all of them, because Receiving
 * never sees the financial value of goods.
 */
export interface OpenPurchaseOrder {
  poNumber: string;
  supplierId: string;
  supplierName: string;
  lines: { sku: string; productName: string; quantityOrdered: number }[];
}

interface ProcurementPoResponse extends OpenPurchaseOrder {
  lines: {
    sku: string;
    productName: string;
    quantityOrdered: number;
    unitCost?: unknown;
  }[];
}

/**
 * Server-to-server REST client for FR-3.1: Receiving asks Procurement whether
 * an open, approved PO exists for an arriving delivery. Plain `fetch` (Node 20
 * global), matching Procurement's Vendor Management client.
 */
@Injectable()
export class ProcurementClientService {
  private readonly logger = new Logger(ProcurementClientService.name);
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl =
      this.config.get<string>("PROCUREMENT_URL") ?? "http://localhost:3002";
  }

  async findOpenPo(poNumber: string): Promise<OpenPurchaseOrder> {
    const url = `${this.baseUrl}/purchase-orders/lookup/${encodeURIComponent(poNumber)}`;
    let response: Response;
    try {
      response = await fetch(url);
    } catch (error) {
      this.logger.error(`Procurement unreachable at ${url}: ${(error as Error).message}`);
      throw new ServiceUnavailableException(
        "Procurement is unreachable — cannot validate this delivery right now.",
      );
    }

    if (response.status === 404) {
      throw new NotFoundException(`No open, approved PO ${poNumber}`);
    }
    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Procurement returned ${response.status} for PO ${poNumber}`,
      );
    }

    const po = (await response.json()) as ProcurementPoResponse;
    return {
      poNumber: po.poNumber,
      supplierId: po.supplierId,
      supplierName: po.supplierName,
      lines: po.lines.map((line) => ({
        sku: line.sku,
        productName: line.productName,
        quantityOrdered: line.quantityOrdered,
      })),
    };
  }
}
