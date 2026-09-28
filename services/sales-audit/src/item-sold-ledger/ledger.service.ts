import { Injectable, Logger } from "@nestjs/common";
import { ItemSoldEvent } from "@mms/shared";
import { LedgerRepository } from "./ledger.repository";

@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);

  constructor(private readonly ledgers: LedgerRepository) {}

  /**
   * FR-7.1/7.3/7.7 — accumulates one sale onto its store-day's running
   * expected total and that cashier/register's own line (for pattern
   * detection, D-4). Applied at most once per eventId, since the bus may
   * redeliver and this consumer's target rows are additive aggregates
   * rather than an upsert-by-natural-key.
   */
  async recordSale(event: ItemSoldEvent): Promise<void> {
    if (await this.ledgers.isEventApplied(event.eventId)) {
      this.logger.log(`ItemSold ${event.eventId} already applied — skipping`);
      return;
    }

    await this.ledgers.applySale({
      eventId: event.eventId,
      storeId: event.storeId,
      businessDate: event.occurredAt.slice(0, 10),
      cashierId: event.cashierId,
      registerId: event.registerId,
      amount: event.totalAmount,
    });
  }

  getLedger(storeId: string, businessDate: string) {
    return this.ledgers.findByStoreDay(storeId, businessDate);
  }

  /** Daily close needs a ledger row to hang off even on a day with zero sales. */
  ensureLedger(storeId: string, businessDate: string) {
    return this.ledgers.ensureForStoreDay(storeId, businessDate);
  }
}
