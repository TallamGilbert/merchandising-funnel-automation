import { ItemSoldEvent } from "@mms/shared";
import { PrismaService } from "../prisma/prisma.service";
import { LedgerService } from "./ledger.service";

describe("LedgerService", () => {
  let service: LedgerService;
  let tx: {
    storeDayLedger: Record<string, jest.Mock>;
    cashierLedgerLine: Record<string, jest.Mock>;
    appliedItemSoldEvent: Record<string, jest.Mock>;
  };
  let prisma: {
    appliedItemSoldEvent: Record<string, jest.Mock>;
    storeDayLedger: Record<string, jest.Mock>;
    $transaction: jest.Mock;
  };

  const event: ItemSoldEvent = {
    eventId: "e1",
    occurredAt: "2026-09-24T14:30:00.000Z",
    transactionId: "txn-1",
    storeId: "STORE-1",
    registerId: "REG-1",
    cashierId: "cashier-amy",
    lines: [],
    paymentMethods: [],
    totalAmount: 21.6,
  };

  beforeEach(() => {
    tx = {
      storeDayLedger: { upsert: jest.fn().mockResolvedValue({ id: "ledger-1" }) },
      cashierLedgerLine: { upsert: jest.fn() },
      appliedItemSoldEvent: { create: jest.fn() },
    };
    prisma = {
      appliedItemSoldEvent: { findUnique: jest.fn().mockResolvedValue(null) },
      storeDayLedger: { findUnique: jest.fn(), upsert: jest.fn() },
      $transaction: jest.fn((callback) => callback(tx)),
    };

    service = new LedgerService(prisma as unknown as PrismaService);
  });

  it("accumulates the store-day total and the cashier's own line", async () => {
    await service.recordSale(event);

    expect(tx.storeDayLedger.upsert).toHaveBeenCalledWith({
      where: { storeId_businessDate: { storeId: "STORE-1", businessDate: "2026-09-24" } },
      create: { storeId: "STORE-1", businessDate: "2026-09-24", expectedTotal: 21.6 },
      update: { expectedTotal: { increment: 21.6 } },
    });
    expect(tx.cashierLedgerLine.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          storeDayLedgerId_cashierId_registerId: {
            storeDayLedgerId: "ledger-1",
            cashierId: "cashier-amy",
            registerId: "REG-1",
          },
        },
      }),
    );
    expect(tx.appliedItemSoldEvent.create).toHaveBeenCalledWith({ data: { eventId: "e1" } });
  });

  it("is a no-op for a redelivered eventId", async () => {
    prisma.appliedItemSoldEvent.findUnique.mockResolvedValue({ eventId: "e1" });

    await service.recordSale(event);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
