import { BadRequestException } from "@nestjs/common";
import { EventBusService, EventRoutingKey } from "@mms/shared";
import { PickTaskStatus, TransferStatus } from "../generated/prisma";
import { InventoryClientService } from "../inventory-client/inventory-client.service";
import { PrismaService } from "../prisma/prisma.service";
import { TransfersService } from "./transfers.service";

describe("TransfersService", () => {
  let service: TransfersService;
  let prisma: {
    transfer: Record<string, jest.Mock>;
    pickTask: Record<string, jest.Mock>;
    binStock: Record<string, jest.Mock>;
    bin: Record<string, jest.Mock>;
    $queryRaw: jest.Mock;
    $transaction: jest.Mock;
  };
  let inventory: { confirmBinLocation: jest.Mock };
  let eventBus: { publish: jest.Mock };

  const dto = {
    sku: "SKU-1",
    quantity: 10,
    fromLocationCode: "WH-MAIN",
    toLocationCode: "STORE-1",
    requestedById: "sup-1",
  };
  const stock = (binId: string, pickPriority: number, quantity: number) => ({
    id: `stock-${binId}`,
    binId,
    quantity,
    bin: { id: binId, pickPriority },
  });

  beforeEach(() => {
    prisma = {
      transfer: {
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: "tr-1" }),
        update: jest.fn(),
      },
      pickTask: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn().mockReturnValue("pick-update"),
      },
      binStock: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn().mockReturnValue("stock-update"),
      },
      bin: { update: jest.fn().mockReturnValue("bin-update") },
      $queryRaw: jest.fn().mockResolvedValue([{ nextval: BigInt(1) }]),
      $transaction: jest.fn(),
    };
    inventory = { confirmBinLocation: jest.fn() };
    eventBus = { publish: jest.fn() };
    service = new TransfersService(
      prisma as unknown as PrismaService,
      inventory as unknown as InventoryClientService,
      eventBus as unknown as EventBusService,
    );
  });

  describe("create", () => {
    it("draws picks from the bins nearest dispatch first", async () => {
      prisma.binStock.findMany.mockResolvedValue([
        stock("far", 80, 20),
        stock("near", 10, 6),
      ]);

      await service.create(dto);

      expect(prisma.transfer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            transferNumber: "TRF-1001",
            picks: {
              create: [
                { binId: "near", sku: "SKU-1", quantity: 6 },
                { binId: "far", sku: "SKU-1", quantity: 4 },
              ],
            },
          }),
        }),
      );
    });

    it("does not offer stock already promised to another open pick", async () => {
      prisma.binStock.findMany.mockResolvedValue([stock("near", 10, 10), stock("far", 80, 20)]);
      prisma.pickTask.findMany.mockResolvedValue([{ binId: "near", quantity: 8 }]);

      await service.create(dto);

      const picks = prisma.transfer.create.mock.calls[0][0].data.picks.create;
      expect(picks).toEqual([
        { binId: "near", sku: "SKU-1", quantity: 2 },
        { binId: "far", sku: "SKU-1", quantity: 8 },
      ]);
    });

    it("rejects a transfer the source location's bins cannot cover", async () => {
      prisma.binStock.findMany.mockResolvedValue([stock("near", 10, 4)]);

      await expect(service.create(dto)).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.transfer.create).not.toHaveBeenCalled();
    });

    it("rejects a transfer to the same location", async () => {
      await expect(
        service.create({ ...dto, toLocationCode: "WH-MAIN" }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe("completePick", () => {
    const pick = {
      id: "p1",
      transferId: "tr-1",
      binId: "bin-A",
      sku: "SKU-1",
      quantity: 6,
      status: PickTaskStatus.PENDING,
      bin: { id: "bin-A", code: "A-01", locationCode: "WH-MAIN" },
    };
    const binStock = { id: "stock-A", quantity: 10, unitVolumeCm3: "180000", unitWeightKg: "8" };

    const transferWith = (
      picks: { status: PickTaskStatus }[],
      status: TransferStatus = TransferStatus.PICKING,
    ) => ({
      id: "tr-1",
      transferNumber: "TRF-1001",
      sku: "SKU-1",
      quantity: 10,
      fromLocationCode: "WH-MAIN",
      toLocationCode: "STORE-1",
      status,
      picks,
    });

    beforeEach(() => {
      prisma.pickTask.findUnique.mockResolvedValue(pick);
      prisma.binStock.findUnique.mockResolvedValue(binStock);
      prisma.transfer.findUnique.mockResolvedValue(transferWith([{ status: PickTaskStatus.PICKED }]));
    });

    it("rejects a scan of the wrong bin", async () => {
      await expect(
        service.completePick("p1", { pickedById: "w1", scannedBinCode: "B-09" }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("removes stock and frees the bin's capacity", async () => {
      await service.completePick("p1", { pickedById: "w1", scannedBinCode: "A-01" });

      expect(prisma.binStock.update).toHaveBeenCalledWith({
        where: { id: "stock-A" },
        data: { quantity: { decrement: 6 } },
      });
      expect(prisma.bin.update).toHaveBeenCalledWith({
        where: { id: "bin-A" },
        data: {
          usedVolumeCm3: { decrement: 1_080_000 },
          usedWeightKg: { decrement: 48 },
        },
      });
    });

    it("publishes StockTransferred, then completes the transfer, on its last pick (D-7)", async () => {
      await service.completePick("p1", { pickedById: "w1", scannedBinCode: "A-01" });

      expect(eventBus.publish).toHaveBeenCalledWith(
        EventRoutingKey.STOCK_TRANSFERRED,
        expect.objectContaining({
          transferNumber: "TRF-1001",
          sku: "SKU-1",
          quantity: 10,
          fromLocationCode: "WH-MAIN",
          toLocationCode: "STORE-1",
        }),
      );
      const event = eventBus.publish.mock.calls[0][1];
      expect(JSON.stringify(event)).not.toMatch(/cost|price|bin/i);
      expect(prisma.transfer.update).toHaveBeenCalledWith({
        where: { id: "tr-1" },
        data: expect.objectContaining({ status: TransferStatus.COMPLETED }),
      });
      expect(eventBus.publish.mock.invocationCallOrder[0]).toBeLessThan(
        prisma.transfer.update.mock.invocationCallOrder[0],
      );
    });

    it("leaves the transfer open, and publishes nothing, while other picks are pending", async () => {
      prisma.transfer.findUnique.mockResolvedValue(
        transferWith([{ status: PickTaskStatus.PICKED }, { status: PickTaskStatus.PENDING }]),
      );

      await service.completePick("p1", { pickedById: "w1", scannedBinCode: "A-01" });

      expect(eventBus.publish).not.toHaveBeenCalled();
      expect(prisma.transfer.update).not.toHaveBeenCalled();
    });

    it("keeps the transfer open when publishing fails, so a retry can finish it", async () => {
      eventBus.publish.mockRejectedValue(new Error("broker down"));

      await expect(
        service.completePick("p1", { pickedById: "w1", scannedBinCode: "A-01" }),
      ).rejects.toThrow("broker down");
      expect(prisma.transfer.update).not.toHaveBeenCalled();
    });

    it("finishes an all-picked transfer when the last pick is confirmed again", async () => {
      prisma.pickTask.findUnique.mockResolvedValue({ ...pick, status: PickTaskStatus.PICKED });

      await service.completePick("p1", { pickedById: "w1", scannedBinCode: "A-01" });

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(eventBus.publish).toHaveBeenCalledTimes(1);
      expect(prisma.transfer.update).toHaveBeenCalled();
    });

    it("rejects re-confirming a pick once its transfer is already completed", async () => {
      prisma.pickTask.findUnique.mockResolvedValue({ ...pick, status: PickTaskStatus.PICKED });
      prisma.transfer.findUnique.mockResolvedValue(
        transferWith([{ status: PickTaskStatus.PICKED }], TransferStatus.COMPLETED),
      );

      await expect(
        service.completePick("p1", { pickedById: "w1", scannedBinCode: "A-01" }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it("does not fail the pick when syncing Inventory's bin record fails", async () => {
      inventory.confirmBinLocation.mockRejectedValue(new Error("down"));

      await expect(
        service.completePick("p1", { pickedById: "w1", scannedBinCode: "A-01" }),
      ).resolves.toBeDefined();
    });
  });
});
