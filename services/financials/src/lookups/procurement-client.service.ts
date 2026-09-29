import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { getJson } from "./http";

export interface PurchaseOrderRecord {
  poNumber: string;
  supplierId: string;
  supplierName: string;
  paymentTermsDays: number;
  currency: string;
  lines: { sku: string; productName: string; unitCost: string }[];
}

/**
 * FR-8.1: GoodsReceived deliberately carries no cost ("Receiving does not
 * know the financial value of the goods"), so a receipt is valued at the
 * unit costs and terms Procurement froze on the PO.
 */
@Injectable()
export class ProcurementClientService {
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.baseUrl = config.get<string>("PROCUREMENT_URL") ?? "http://localhost:3002";
  }

  getPurchaseOrder(poNumber: string): Promise<PurchaseOrderRecord> {
    return getJson(
      `${this.baseUrl}/purchase-orders/by-number/${encodeURIComponent(poNumber)}`,
      `Purchase order ${poNumber}`,
    );
  }
}
