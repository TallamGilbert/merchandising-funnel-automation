import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import {
  EventBusService,
  EventRoutingKey,
  GoodsReceivedEvent,
  isModuleEnabled,
  ModuleKey,
} from "@mms/shared";
import { StockService } from "../stock/stock.service";

/** FR-4.2 — increases On Hand for GOOD-condition lines on GoodsReceived. */
@Injectable()
export class GoodsReceivedConsumer implements OnModuleInit {
  private readonly logger = new Logger(GoodsReceivedConsumer.name);

  constructor(
    private readonly eventBus: EventBusService,
    private readonly stock: StockService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!isModuleEnabled(ModuleKey.INVENTORY)) {
      this.logger.warn("Inventory module disabled — not subscribing to GoodsReceived.");
      return;
    }

    await this.eventBus.subscribe<GoodsReceivedEvent>(
      "inventory.goods-received",
      [EventRoutingKey.GOODS_RECEIVED],
      async (event) => {
        await this.stock.applyGoodsReceived(event);
      },
    );
  }
}
