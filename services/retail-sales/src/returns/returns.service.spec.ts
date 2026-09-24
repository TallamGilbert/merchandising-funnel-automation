import { BadRequestException, NotFoundException } from "@nestjs/common";
import { EventBusService, EventRoutingKey } from "@mms/shared";
import { PrismaService } from "../prisma/prisma.service";
import { ReturnsService } from "./returns.service";

describe("ReturnsService", () => {
  let service: ReturnsService;
  let prisma: {
    transaction: Record<string, jest.Mock>;
    transactionLine: Record<string, jest.Mock>;
    returnTransaction: Record<string, jest.Mock>;
    $queryRaw: jest.Mock;
    $transaction: jest.Mock;
  };
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
    prisma = {
      transaction: {
        findUnique: jest.fn().mockResolvedValue({
          id: "txn-1",
          lines: [transactionLine],
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      transactionLine: {
        findMany: jest.fn(),
        update: jest.fn().mockReturnValue("line-update"),
      },
      returnTransaction: {
        create: jest.fn().mockReturnValue("return-create"),
      },
      $queryRaw: jest.fn().mockResolvedValue([{ nextval: BigInt(1) }]),
      $transaction: jest.fn(),
    };
    eventBus = { publish: jest.fn() };

    service = new ReturnsService(
      prisma as unknown as PrismaService,
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
    prisma.transaction.findUnique.mockResolvedValue(null);
    await expect(service.processReturn(dto)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects returning more than remains on the line", async () => {
    await expect(
      service.processReturn({ ...dto, lines: [{ transactionLineId: "line-1", quantityReturned: 5 }] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("records the return, flips the transaction to RETURNED once fully returned, and publishes ItemReturned", async () => {
    prisma.$transaction.mockResolvedValue([{ id: "ret-1" }]);
    prisma.transactionLine.findMany.mockResolvedValue([{ ...transactionLine, quantityReturned: 2 }]);

    await service.processReturn(dto);

    expect(prisma.returnTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          returnNumber: "RET-1001",
          refundAmount: 21.6,
          lines: { create: [expect.objectContaining({ sku: "SKU-1", quantityReturned: 2, refundAmount: 21.6 })] },
        }),
      }),
    );
    expect(prisma.transaction.update).toHaveBeenCalledWith({
      where: { id: "txn-1" },
      data: { status: "RETURNED" },
    });
    expect(eventBus.publish).toHaveBeenCalledWith(
      EventRoutingKey.ITEM_RETURNED,
      expect.objectContaining({
        originalTransactionId: "txn-1",
        lines: [expect.objectContaining({ sku: "SKU-1", quantityReturned: 2, refundAmount: 21.6 })],
      }),
    );
  });

  it("leaves the transaction status alone on a partial return", async () => {
    prisma.$transaction.mockResolvedValue([{ id: "ret-1" }]);
    prisma.transactionLine.findMany.mockResolvedValue([{ ...transactionLine, quantityReturned: 1 }]);

    await service.processReturn({ ...dto, lines: [{ transactionLineId: "line-1", quantityReturned: 1 }] });

    expect(prisma.transaction.update).not.toHaveBeenCalled();
  });
});
