import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import {
  EventBusService,
  EventRoutingKey,
  isModuleEnabled,
  ItemSoldEvent,
  ModuleKey,
} from "@mms/shared";
import { LedgerService } from "./ledger.service";

/** FR-7.7 — keeps the store-day expected total current as sales happen. */
@Injectable()
export class ItemSoldConsumer implements OnModuleInit {
  private readonly logger = new Logger(ItemSoldConsumer.name);

  constructor(
    private readonly eventBus: EventBusService,
    private readonly ledger: LedgerService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!isModuleEnabled(ModuleKey.SALES_AUDIT)) {
      this.logger.warn("Sales Audit module disabled — not subscribing to ItemSold.");
      return;
    }

    await this.eventBus.subscribe<ItemSoldEvent>(
      "sales-audit.item-sold",
      [EventRoutingKey.ITEM_SOLD],
      async (event) => {
        await this.ledger.recordSale(event);
      },
    );
  }
}
