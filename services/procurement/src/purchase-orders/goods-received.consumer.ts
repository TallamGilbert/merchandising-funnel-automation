import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import {
  EventBusService,
  EventRoutingKey,
  GoodsReceivedEvent,
  isModuleEnabled,
  ModuleKey,
} from "@mms/shared";
import { PurchaseOrdersService } from "./purchase-orders.service";

/** FR-2.5 / D-6 — consumes GoodsReceived to track remaining open quantity on a PO. */
@Injectable()
export class GoodsReceivedConsumer implements OnModuleInit {
  private readonly logger = new Logger(GoodsReceivedConsumer.name);

  constructor(
    private readonly eventBus: EventBusService,
    private readonly purchaseOrders: PurchaseOrdersService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!isModuleEnabled(ModuleKey.PROCUREMENT)) {
      this.logger.warn("Procurement module disabled — not subscribing to GoodsReceived.");
      return;
    }

    await this.eventBus.subscribe<GoodsReceivedEvent>(
      "procurement.goods-received",
      [EventRoutingKey.GOODS_RECEIVED],
      async (event) => {
        await this.purchaseOrders.applyGoodsReceived(event);
      },
    );
  }
}
