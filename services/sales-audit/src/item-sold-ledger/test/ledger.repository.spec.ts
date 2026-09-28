import { PrismaService } from "../../prisma/prisma.service";
import { LedgerRepository } from "../ledger.repository";

describe("LedgerRepository", () => {
  let repository: LedgerRepository;
  let tx: {
    storeDayLedger: Record<string, jest.Mock>;
    cashierLedgerLine: Record<string, jest.Mock>;
    appliedItemSoldEvent: Record<string, jest.Mock>;
  };
  let prisma: {
    appliedItemSoldEvent: Record<string, jest.Mock>;
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    tx = {
      storeDayLedger: { upsert: jest.fn().mockResolvedValue({ id: "ledger-1" }) },
      cashierLedgerLine: { upsert: jest.fn() },
      appliedItemSoldEvent: { create: jest.fn() },
    };
    prisma = {
      appliedItemSoldEvent: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((callback) => callback(tx)),
    };

    repository = new LedgerRepository(prisma as unknown as PrismaService);
  });

  it("accumulates the store-day total and the cashier's own line, and marks the event applied", async () => {
    await repository.applySale({
      eventId: "e1",
      storeId: "STORE-1",
      businessDate: "2026-09-24",
      cashierId: "cashier-amy",
      registerId: "REG-1",
      amount: 21.6,
    });

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

  it("reports whether an event has already been applied", async () => {
    expect(await repository.isEventApplied("e1")).toBe(false);

    prisma.appliedItemSoldEvent.findUnique.mockResolvedValue({ eventId: "e1" });
    expect(await repository.isEventApplied("e1")).toBe(true);
  });
});
