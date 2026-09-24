import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface ExpectedTotalResponse {
  storeId: string;
  businessDate: string;
  expectedTotal: number;
}

/**
 * Server-to-server REST client for D-9's close-time cross-check: Sales
 * Audit's own ItemSold-driven accumulator is the primary running total, but
 * at close it confirms against Retail Sales' own record. Plain `fetch`
 * (Node 20 global), matching Receiving's Procurement client.
 */
@Injectable()
export class RetailSalesClientService {
  private readonly logger = new Logger(RetailSalesClientService.name);
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl =
      this.config.get<string>("RETAIL_SALES_URL") ?? "http://localhost:3006";
  }

  async getExpectedTotal(storeId: string, businessDate: string): Promise<ExpectedTotalResponse> {
    const url = `${this.baseUrl}/stores/${encodeURIComponent(storeId)}/expected-total?businessDate=${encodeURIComponent(businessDate)}`;
    let response: Response;
    try {
      response = await fetch(url);
    } catch (error) {
      this.logger.error(`Retail Sales unreachable at ${url}: ${(error as Error).message}`);
      throw new ServiceUnavailableException(
        "Retail Sales is unreachable — cannot cross-check the expected total right now.",
      );
    }

    if (response.status === 404) {
      throw new NotFoundException(`No expected total for store ${storeId} on ${businessDate}`);
    }
    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Retail Sales returned ${response.status} for store ${storeId}`,
      );
    }

    return (await response.json()) as ExpectedTotalResponse;
  }
}
