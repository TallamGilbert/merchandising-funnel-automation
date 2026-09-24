import { Injectable, Logger } from "@nestjs/common";
import { ItemSoldEvent } from "@mms/shared";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * FR-7.1/7.3/7.7 — accumulates one sale onto its store-day's running
   * expected total and that cashier/register's own line (for pattern
   * detection, D-4). Applied at most once per eventId, since the bus may
   * redeliver and this consumer's target rows are additive aggregates
   * rather than an upsert-by-natural-key.
   */
  async recordSale(event: ItemSoldEvent): Promise<void> {
    const alreadyApplied = await this.prisma.appliedItemSoldEvent.findUnique({
      where: { eventId: event.eventId },
    });
    if (alreadyApplied) {
      this.logger.log(`ItemSold ${event.eventId} already applied — skipping`);
      return;
    }

    const businessDate = event.occurredAt.slice(0, 10);

    await this.prisma.$transaction(async (tx) => {
      const ledger = await tx.storeDayLedger.upsert({
        where: { storeId_businessDate: { storeId: event.storeId, businessDate } },
        create: { storeId: event.storeId, businessDate, expectedTotal: event.totalAmount },
        update: { expectedTotal: { increment: event.totalAmount } },
      });

      await tx.cashierLedgerLine.upsert({
        where: {
          storeDayLedgerId_cashierId_registerId: {
            storeDayLedgerId: ledger.id,
            cashierId: event.cashierId,
            registerId: event.registerId,
          },
        },
        create: {
          storeDayLedgerId: ledger.id,
          cashierId: event.cashierId,
          registerId: event.registerId,
          expectedAmount: event.totalAmount,
        },
        update: { expectedAmount: { increment: event.totalAmount } },
      });

      await tx.appliedItemSoldEvent.create({ data: { eventId: event.eventId } });
    });
  }

  getLedger(storeId: string, businessDate: string) {
    return this.prisma.storeDayLedger.findUnique({
      where: { storeId_businessDate: { storeId, businessDate } },
      include: { cashierLines: true },
    });
  }

  /** Daily close needs a ledger row to hang off even on a day with zero sales. */
  ensureLedger(storeId: string, businessDate: string) {
    return this.prisma.storeDayLedger.upsert({
      where: { storeId_businessDate: { storeId, businessDate } },
      create: { storeId, businessDate, expectedTotal: 0 },
      update: {},
    });
  }
}
