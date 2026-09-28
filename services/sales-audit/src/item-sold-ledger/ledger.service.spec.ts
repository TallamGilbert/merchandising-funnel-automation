import { ItemSoldEvent } from "@mms/shared";
import { LedgerRepository } from "./ledger.repository";
import { LedgerService } from "./ledger.service";

describe("LedgerService", () => {
  let service: LedgerService;
  let ledgers: { isEventApplied: jest.Mock; applySale: jest.Mock };

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
    ledgers = {
      isEventApplied: jest.fn().mockResolvedValue(false),
      applySale: jest.fn().mockResolvedValue(undefined),
    };

    service = new LedgerService(ledgers as unknown as LedgerRepository);
  });

  it("applies the sale to the store-day of its occurredAt date", async () => {
    await service.recordSale(event);

    expect(ledgers.applySale).toHaveBeenCalledWith({
      eventId: "e1",
      storeId: "STORE-1",
      businessDate: "2026-09-24",
      cashierId: "cashier-amy",
      registerId: "REG-1",
      amount: 21.6,
    });
  });

  it("is a no-op for a redelivered eventId", async () => {
    ledgers.isEventApplied.mockResolvedValue(true);

    await service.recordSale(event);

    expect(ledgers.applySale).not.toHaveBeenCalled();
  });
});
