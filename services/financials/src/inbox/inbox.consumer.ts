import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { EventBusService, EventRoutingKey, isModuleEnabled, ModuleKey } from "@mms/shared";
import { InboxProcessor } from "./inbox.processor";
import { InboxRepository } from "./inbox.repository";

const CONSUMED: EventRoutingKey[] = [
  EventRoutingKey.GOODS_RECEIVED,
  EventRoutingKey.ITEM_SOLD,
  EventRoutingKey.ITEM_RETURNED,
  EventRoutingKey.DAY_CLOSED,
];

/**
 * FR-8.1–8.3 (+ D-14 returns). The handler only has to store the event —
 * once it's in the inbox it's acknowledged, and posting (which calls
 * Procurement/Inventory) can fail and retry without the bus dropping it.
 */
@Injectable()
export class InboxConsumer implements OnModuleInit {
  private readonly logger = new Logger(InboxConsumer.name);

  constructor(
    private readonly eventBus: EventBusService,
    private readonly inboxRepository: InboxRepository,
    private readonly processor: InboxProcessor,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!isModuleEnabled(ModuleKey.FINANCIALS)) {
      this.logger.warn("Financials module disabled — not subscribing to events.");
      return;
    }

    // One queue per routing key, so each is visible (and backs up) on its own
    // in RabbitMQ while Financials is down.
    for (const routingKey of CONSUMED) {
      await this.eventBus.subscribe<{ eventId: string }>(`financials.${routingKey}`, [routingKey], async (event) => {
        await this.inboxRepository.store(event.eventId, routingKey, event);
        await this.processor.process(event.eventId);
      });
    }
  }
}
