import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface SaleToApply {
  eventId: string;
  storeId: string;
  businessDate: string;
  cashierId: string;
  registerId: string;
  amount: number;
}

@Injectable()
export class LedgerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async isEventApplied(eventId: string): Promise<boolean> {
    const applied = await this.prisma.appliedItemSoldEvent.findUnique({ where: { eventId } });
    return applied !== null;
  }

  /**
   * Adds one sale to the store-day total and the cashier/register line, and
   * marks the event applied, all in one database transaction so a redelivery
   * can never be counted twice.
   */
  async applySale(sale: SaleToApply): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const ledger = await tx.storeDayLedger.upsert({
        where: { storeId_businessDate: { storeId: sale.storeId, businessDate: sale.businessDate } },
        create: { storeId: sale.storeId, businessDate: sale.businessDate, expectedTotal: sale.amount },
        update: { expectedTotal: { increment: sale.amount } },
      });

      await tx.cashierLedgerLine.upsert({
        where: {
          storeDayLedgerId_cashierId_registerId: {
            storeDayLedgerId: ledger.id,
            cashierId: sale.cashierId,
            registerId: sale.registerId,
          },
        },
        create: {
          storeDayLedgerId: ledger.id,
          cashierId: sale.cashierId,
          registerId: sale.registerId,
          expectedAmount: sale.amount,
        },
        update: { expectedAmount: { increment: sale.amount } },
      });

      await tx.appliedItemSoldEvent.create({ data: { eventId: sale.eventId } });
    });
  }

  findByStoreDay(storeId: string, businessDate: string) {
    return this.prisma.storeDayLedger.findUnique({
      where: { storeId_businessDate: { storeId, businessDate } },
      include: { cashierLines: true },
    });
  }

  ensureForStoreDay(storeId: string, businessDate: string) {
    return this.prisma.storeDayLedger.upsert({
      where: { storeId_businessDate: { storeId, businessDate } },
      create: { storeId, businessDate, expectedTotal: 0 },
      update: {},
    });
  }
}
