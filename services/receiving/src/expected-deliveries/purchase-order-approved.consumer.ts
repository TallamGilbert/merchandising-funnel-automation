import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import {
  EventBusService,
  EventRoutingKey,
  isModuleEnabled,
  ModuleKey,
  PurchaseOrderApprovedEvent,
} from "@mms/shared";
import { ExpectedDeliveriesService } from "./expected-deliveries.service";

/** FR-3.7 — consumes PurchaseOrderApproved so Receiving knows what deliveries to expect. */
@Injectable()
export class PurchaseOrderApprovedConsumer implements OnModuleInit {
  private readonly logger = new Logger(PurchaseOrderApprovedConsumer.name);

  constructor(
    private readonly eventBus: EventBusService,
    private readonly expectedDeliveries: ExpectedDeliveriesService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!isModuleEnabled(ModuleKey.RECEIVING)) {
      this.logger.warn("Receiving module disabled — not subscribing to PurchaseOrderApproved.");
      return;
    }

    await this.eventBus.subscribe<PurchaseOrderApprovedEvent>(
      "receiving.purchase-order-approved",
      [EventRoutingKey.PURCHASE_ORDER_APPROVED],
      async (event) => {
        await this.expectedDeliveries.recordFromEvent(event);
      },
    );
  }
}
