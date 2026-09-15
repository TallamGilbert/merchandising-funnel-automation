import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import {
  EventBusService,
  EventRoutingKey,
  isModuleEnabled,
  ModuleKey,
  StockLowEvent,
} from "@mms/shared";
import { ReorderSuggestionsService } from "./reorder-suggestions.service";

/** FR-2.7 — consumes Inventory's StockLow events and turns each into a reorder suggestion. */
@Injectable()
export class StockLowConsumer implements OnModuleInit {
  private readonly logger = new Logger(StockLowConsumer.name);

  constructor(
    private readonly eventBus: EventBusService,
    private readonly reorderSuggestions: ReorderSuggestionsService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!isModuleEnabled(ModuleKey.PROCUREMENT)) {
      this.logger.warn("Procurement module disabled — not subscribing to StockLow.");
      return;
    }

    await this.eventBus.subscribe<StockLowEvent>(
      "procurement.stock-low",
      [EventRoutingKey.STOCK_LOW],
      async (event) => {
        await this.reorderSuggestions.createFromStockLowEvent(event);
      },
    );
  }
}
