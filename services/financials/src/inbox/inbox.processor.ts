import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import {
  DayClosedEvent,
  EventRoutingKey,
  GoodsReceivedEvent,
  ItemReturnedEvent,
  ItemSoldEvent,
} from "@mms/shared";
import { UnbalancedEntryError } from "../ledger/journal";
import { LedgerRepository } from "../ledger/ledger.repository";
import { PermanentPostingError } from "../postings/posting-errors";
import { PostingPlan } from "../postings/posting-plan";
import { PostingsService } from "../postings/postings.service";
import { InboxRepository } from "./inbox.repository";

const SWEEP_MS = 15_000;
const BATCH = 25;
const MAX_BACKOFF_MS = 60 * 60 * 1000;

export type ProcessResult = "posted" | "retry" | "needs-attention" | "skipped";

/** 15s, 30s, 1m, 2m … capped at an hour — a service that's down gets time to recover. */
export function backoffMs(attempts: number): number {
  return Math.min(15_000 * 2 ** Math.max(attempts - 1, 0), MAX_BACKOFF_MS);
}

/**
 * Posts stored events to the ledger. Each event is tried as soon as it
 * arrives; anything that fails for a transient reason is retried by a sweep
 * with backoff, and anything a person has to fix is flagged.
 */
@Injectable()
export class InboxProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InboxProcessor.name);
  private timer: NodeJS.Timeout | null = null;
  private sweeping = false;

  constructor(
    private readonly inbox: InboxRepository,
    private readonly postings: PostingsService,
    private readonly ledger: LedgerRepository,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.sweep(), SWEEP_MS);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async sweep(): Promise<void> {
    if (this.sweeping) return;
    this.sweeping = true;
    try {
      for (const event of await this.inbox.findDue(new Date(), BATCH)) {
        await this.process(event.eventId);
      }
    } catch (error) {
      this.logger.error(`Inbox sweep failed: ${(error as Error).message}`);
    } finally {
      this.sweeping = false;
    }
  }

  async process(eventId: string): Promise<ProcessResult> {
    const event = await this.inbox.findById(eventId);
    if (!event || event.status !== "PENDING") return "skipped";
    const attempts = event.attempts + 1;

    try {
      const plan = await this.plan(event.routingKey, event.payload);
      const { duplicate } = await this.ledger.commit(plan, eventId);
      if (duplicate) this.logger.log(`${event.routingKey} ${eventId} was already booked — marked posted`);
      return "posted";
    } catch (error) {
      const message = (error as Error).message;
      if (error instanceof PermanentPostingError || error instanceof UnbalancedEntryError) {
        this.logger.warn(`${event.routingKey} ${eventId} needs attention: ${message}`);
        await this.inbox.markNeedsAttention(eventId, attempts, message);
        return "needs-attention";
      }
      const delay = backoffMs(attempts);
      this.logger.warn(`${event.routingKey} ${eventId} not posted (attempt ${attempts}), retrying in ${delay / 1000}s: ${message}`);
      await this.inbox.scheduleRetry(eventId, attempts, message, new Date(Date.now() + delay));
      return "retry";
    }
  }

  private plan(routingKey: string, payload: unknown): Promise<PostingPlan> | PostingPlan {
    switch (routingKey) {
      case EventRoutingKey.GOODS_RECEIVED:
        return this.postings.goodsReceived(payload as GoodsReceivedEvent);
      case EventRoutingKey.ITEM_SOLD:
        return this.postings.itemSold(payload as ItemSoldEvent);
      case EventRoutingKey.ITEM_RETURNED:
        return this.postings.itemReturned(payload as ItemReturnedEvent);
      case EventRoutingKey.DAY_CLOSED:
        return this.postings.dayClosed(payload as DayClosedEvent);
      default:
        throw new PermanentPostingError(`No posting rule for ${routingKey}`);
    }
  }
}
