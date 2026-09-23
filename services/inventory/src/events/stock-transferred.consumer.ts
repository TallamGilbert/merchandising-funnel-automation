import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import {
  EventBusService,
  EventRoutingKey,
  isModuleEnabled,
  ModuleKey,
  StockTransferredEvent,
} from "@mms/shared";
import { StockService } from "../stock/stock.service";

/** FR-4.1 / D-7 — moves On Hand between locations when Warehouse Operations completes a transfer. */
@Injectable()
export class StockTransferredConsumer implements OnModuleInit {
  private readonly logger = new Logger(StockTransferredConsumer.name);

  constructor(
    private readonly eventBus: EventBusService,
    private readonly stock: StockService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!isModuleEnabled(ModuleKey.INVENTORY)) {
      this.logger.warn("Inventory module disabled — not subscribing to StockTransferred.");
      return;
    }

    await this.eventBus.subscribe<StockTransferredEvent>(
      "inventory.stock-transferred",
      [EventRoutingKey.STOCK_TRANSFERRED],
      async (event) => {
        await this.stock.applyStockTransfer(event);
      },
    );
  }
}
