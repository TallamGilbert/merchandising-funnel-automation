import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import {
  EventBusService,
  EventRoutingKey,
  isModuleEnabled,
  ItemSoldEvent,
  ModuleKey,
} from "@mms/shared";
import { StockService } from "../stock/stock.service";

/** FR-4.2 — decreases On Hand on ItemSold, finalizing the checkout reservation. */
@Injectable()
export class ItemSoldConsumer implements OnModuleInit {
  private readonly logger = new Logger(ItemSoldConsumer.name);

  constructor(
    private readonly eventBus: EventBusService,
    private readonly stock: StockService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!isModuleEnabled(ModuleKey.INVENTORY)) {
      this.logger.warn("Inventory module disabled — not subscribing to ItemSold.");
      return;
    }

    await this.eventBus.subscribe<ItemSoldEvent>(
      "inventory.item-sold",
      [EventRoutingKey.ITEM_SOLD],
      async (event) => {
        for (const line of event.lines) {
          await this.stock.consumeReservationForSale(
            line.reservationId,
            line.quantitySold,
            event.transactionId,
          );
        }
      },
    );
  }
}
