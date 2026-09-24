import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import {
  EventBusService,
  EventRoutingKey,
  isModuleEnabled,
  ItemReturnedEvent,
  ModuleKey,
} from "@mms/shared";
import { StockService } from "../stock/stock.service";

/** FR-6.4 / D-8 — adds returned stock back onto On Hand. */
@Injectable()
export class ItemReturnedConsumer implements OnModuleInit {
  private readonly logger = new Logger(ItemReturnedConsumer.name);

  constructor(
    private readonly eventBus: EventBusService,
    private readonly stock: StockService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!isModuleEnabled(ModuleKey.INVENTORY)) {
      this.logger.warn("Inventory module disabled — not subscribing to ItemReturned.");
      return;
    }

    await this.eventBus.subscribe<ItemReturnedEvent>(
      "inventory.item-returned",
      [EventRoutingKey.ITEM_RETURNED],
      async (event) => {
        for (const line of event.lines) {
          await this.stock.applyItemReturn(
            line.sku,
            line.locationCode,
            line.quantityReturned,
            event.returnId,
          );
        }
      },
    );
  }
}
