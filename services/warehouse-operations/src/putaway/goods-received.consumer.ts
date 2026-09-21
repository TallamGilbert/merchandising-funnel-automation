import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import {
  EventBusService,
  EventRoutingKey,
  GoodsReceivedEvent,
  isModuleEnabled,
  ModuleKey,
} from "@mms/shared";
import { PutawayService } from "./putaway.service";

/** FR-5.6 — consumes GoodsReceived to trigger putaway tasks automatically. */
@Injectable()
export class GoodsReceivedConsumer implements OnModuleInit {
  private readonly logger = new Logger(GoodsReceivedConsumer.name);

  constructor(
    private readonly eventBus: EventBusService,
    private readonly putaway: PutawayService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!isModuleEnabled(ModuleKey.WAREHOUSE_OPERATIONS)) {
      this.logger.warn("Warehouse Operations module disabled — not subscribing to GoodsReceived.");
      return;
    }

    await this.eventBus.subscribe<GoodsReceivedEvent>(
      "warehouse-operations.goods-received",
      [EventRoutingKey.GOODS_RECEIVED],
      async (event) => {
        await this.putaway.createFromGoodsReceived(event);
      },
    );
  }
}
