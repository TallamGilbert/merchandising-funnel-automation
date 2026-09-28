import { BadRequestException, NotFoundException } from "@nestjs/common";
import { EventBusService, EventRoutingKey } from "@mms/shared";
import { TransactionsRepository } from "../transactions/transactions.repository";
import { ReturnsRepository } from "./returns.repository";
import { ReturnsService } from "./returns.service";

describe("ReturnsService", () => {
  let service: ReturnsService;
  let returns: { nextSequence: jest.Mock; createWithLineIncrements: jest.Mock };
  let transactions: { findByIdWithLines: jest.Mock; findLines: jest.Mock; updateStatus: jest.Mock };
  let eventBus: { publish: jest.Mock };

  const transactionLine = {
    id: "line-1",
    sku: "SKU-1",
    productName: "Oak Chair",
    quantitySold: 2,
    quantityReturned: 0,
    lineTotal: 21.6,
    locationCode: "STORE-1",
  };

  beforeEach(() => {
    returns = {
      nextSequence: jest.fn().mockResolvedValue(1),
      createWithLineIncrements: jest.fn().mockResolvedValue({ id: "ret-1" }),
    };
    transactions = {
      findByIdWithLines: jest.fn().mockResolvedValue({
        id: "txn-1",
        lines: [transactionLine],
      }),
      findLines: jest.fn(),
      updateStatus: jest.fn().mockResolvedValue({}),
    };
    eventBus = { publish: jest.fn() };

    service = new ReturnsService(
      returns as unknown as ReturnsRepository,
      transactions as unknown as TransactionsRepository,
      eventBus as unknown as EventBusService,
    );
  });

  const dto = {
    originalTransactionId: "txn-1",
    storeId: "STORE-1",
    registerId: "REG-1",
    lines: [{ transactionLineId: "line-1", quantityReturned: 2 }],
  };

  it("rejects a transaction that doesn't exist", async () => {
    transactions.findByIdWithLines.mockResolvedValue(null);
    await expect(service.processReturn(dto)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects returning more than remains on the line", async () => {
    await expect(
      service.processReturn({ ...dto, lines: [{ transactionLineId: "line-1", quantityReturned: 5 }] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("records the return, flips the transaction to RETURNED once fully returned, and publishes ItemReturned", async () => {
    transactions.findLines.mockResolvedValue([{ ...transactionLine, quantityReturned: 2 }]);

    await service.processReturn(dto);

    expect(returns.createWithLineIncrements).toHaveBeenCalledWith(
      expect.objectContaining({
        returnNumber: "RET-1001",
        refundAmount: 21.6,
        lines: { create: [expect.objectContaining({ sku: "SKU-1", quantityReturned: 2, refundAmount: 21.6 })] },
      }),
      [{ transactionLineId: "line-1", quantityReturned: 2 }],
    );
    expect(transactions.updateStatus).toHaveBeenCalledWith("txn-1", "RETURNED");
    expect(eventBus.publish).toHaveBeenCalledWith(
      EventRoutingKey.ITEM_RETURNED,
      expect.objectContaining({
        originalTransactionId: "txn-1",
        lines: [expect.objectContaining({ sku: "SKU-1", quantityReturned: 2, refundAmount: 21.6 })],
      }),
    );
  });

  it("leaves the transaction status alone on a partial return", async () => {
    transactions.findLines.mockResolvedValue([{ ...transactionLine, quantityReturned: 1 }]);

    await service.processReturn({ ...dto, lines: [{ transactionLineId: "line-1", quantityReturned: 1 }] });

    expect(transactions.updateStatus).not.toHaveBeenCalled();
  });
});
