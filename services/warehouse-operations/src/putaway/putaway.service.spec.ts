import { BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GoodsReceivedEvent } from "@mms/shared";
import { PutawayTaskStatus } from "../generated/prisma";
import { InventoryClientService } from "../inventory-client/inventory-client.service";
import { PrismaService } from "../prisma/prisma.service";
import { PutawayService } from "./putaway.service";

describe("PutawayService", () => {
  let service: PutawayService;
  let prisma: {
    putawayTask: Record<string, jest.Mock>;
    bin: Record<string, jest.Mock>;
    binStock: Record<string, jest.Mock>;
    $transaction: jest.Mock;
  };
  let inventory: { getItemAttributes: jest.Mock; confirmBinLocation: jest.Mock };

  const attributes = {
    sku: "SKU-1",
    lengthCm: 50,
    widthCm: 40,
    heightCm: 90,
    weightKg: 8,
    unitsPerDay: 9,
  };
  const dbBin = (code: string, pickPriority: number, extra = {}) => ({
    id: `bin-${code}`,
    code,
    locationCode: "WH-MAIN",
    pickPriority,
    capacityVolumeCm3: "10000000",
    maxWeightKg: "1000",
    usedVolumeCm3: "0",
    usedWeightKg: "0",
    ...extra,
  });

  const event: GoodsReceivedEvent = {
    eventId: "e1",
    occurredAt: "2026-09-21T08:00:00.000Z",
    grnNumber: "GRN-1001",
    poNumber: "PO-1001",
    supplierId: "supplier-1",
    receivedAtLocation: "WH-MAIN",
    lines: [
      { sku: "SKU-1", productName: "Oak Chair", quantityOrdered: 10, quantityReceived: 8, condition: "GOOD", discrepancyType: "NONE" },
      { sku: "SKU-1", productName: "Oak Chair", quantityOrdered: 0, quantityReceived: 2, condition: "DAMAGED", discrepancyType: "DAMAGE" },
    ],
  };

  beforeEach(() => {
    prisma = {
      putawayTask: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn().mockReturnValue("task-update"),
      },
      bin: { findMany: jest.fn(), update: jest.fn().mockReturnValue("bin-update") },
      binStock: { findUnique: jest.fn(), upsert: jest.fn().mockReturnValue("stock-upsert") },
      $transaction: jest.fn(),
    };
    inventory = {
      getItemAttributes: jest.fn().mockResolvedValue(attributes),
      confirmBinLocation: jest.fn(),
    };
    const config = { get: jest.fn().mockReturnValue(undefined) };

    service = new PutawayService(
      prisma as unknown as PrismaService,
      inventory as unknown as InventoryClientService,
      config as unknown as ConfigService,
    );
  });

  describe("createFromGoodsReceived", () => {
    it("creates a task for the GOOD line only — quarantined damage never goes to a bin", async () => {
      prisma.putawayTask.findUnique.mockResolvedValue(null);
      prisma.putawayTask.create.mockResolvedValue({
        id: "t1", sku: "SKU-1", quantity: 8, locationCode: "WH-MAIN",
        binId: null, reservedVolumeCm3: 0, reservedWeightKg: 0,
      });
      prisma.bin.findMany.mockResolvedValue([dbBin("B-SLOW", 90), dbBin("A-FAST", 10)]);

      await service.createFromGoodsReceived(event);

      expect(prisma.putawayTask.create).toHaveBeenCalledTimes(1);
      expect(prisma.putawayTask.create).toHaveBeenCalledWith({
        data: {
          grnNumber: "GRN-1001",
          poNumber: "PO-1001",
          sku: "SKU-1",
          productName: "Oak Chair",
          quantity: 8,
          locationCode: "WH-MAIN",
        },
      });
    });

    it("directs a high-velocity item to the bin nearest dispatch and reserves its capacity", async () => {
      prisma.putawayTask.findUnique.mockResolvedValue(null);
      prisma.putawayTask.create.mockResolvedValue({
        id: "t1", sku: "SKU-1", quantity: 8, locationCode: "WH-MAIN",
        binId: null, reservedVolumeCm3: 0, reservedWeightKg: 0,
      });
      prisma.bin.findMany.mockResolvedValue([dbBin("B-SLOW", 90), dbBin("A-FAST", 10)]);

      await service.createFromGoodsReceived(event);

      expect(prisma.bin.update).toHaveBeenCalledWith({
        where: { id: "bin-A-FAST" },
        data: {
          usedVolumeCm3: { increment: 50 * 40 * 90 * 8 },
          usedWeightKg: { increment: 64 },
        },
      });
      expect(prisma.putawayTask.update).toHaveBeenCalledWith({
        where: { id: "t1" },
        data: { binId: "bin-A-FAST", reservedVolumeCm3: 1_440_000, reservedWeightKg: 64 },
      });
    });

    it("still records the task, unassigned, when no bin has room", async () => {
      prisma.putawayTask.findUnique.mockResolvedValue(null);
      prisma.putawayTask.create.mockResolvedValue({
        id: "t1", sku: "SKU-1", quantity: 8, locationCode: "WH-MAIN",
        binId: null, reservedVolumeCm3: 0, reservedWeightKg: 0,
      });
      prisma.bin.findMany.mockResolvedValue([dbBin("A", 10, { capacityVolumeCm3: "100" })]);

      await expect(service.createFromGoodsReceived(event)).resolves.toBeUndefined();

      expect(prisma.putawayTask.create).toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("still records the task when Inventory is unreachable", async () => {
      prisma.putawayTask.findUnique.mockResolvedValue(null);
      prisma.putawayTask.create.mockResolvedValue({ id: "t1", sku: "SKU-1", quantity: 8, locationCode: "WH-MAIN" });
      inventory.getItemAttributes.mockRejectedValue(new Error("down"));

      await expect(service.createFromGoodsReceived(event)).resolves.toBeUndefined();

      expect(prisma.putawayTask.create).toHaveBeenCalled();
    });

    it("is idempotent when the event is redelivered", async () => {
      prisma.putawayTask.findUnique.mockResolvedValue({ id: "t1" });

      await service.createFromGoodsReceived(event);

      expect(prisma.putawayTask.create).not.toHaveBeenCalled();
    });
  });

  describe("complete", () => {
    const task = (overrides = {}) => ({
      id: "t1",
      sku: "SKU-1",
      quantity: 8,
      locationCode: "WH-MAIN",
      status: PutawayTaskStatus.PENDING,
      reservedVolumeCm3: "1440000",
      reservedWeightKg: "64",
      bin: { id: "bin-A", code: "A-01" },
      ...overrides,
    });

    it("rejects a scan of the wrong bin", async () => {
      prisma.putawayTask.findUnique.mockResolvedValue(task());

      await expect(
        service.complete("t1", { completedById: "w1", scannedBinCode: "B-09" }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(inventory.confirmBinLocation).not.toHaveBeenCalled();
    });

    it("confirms the bin's absolute quantity to Inventory before committing", async () => {
      prisma.putawayTask.findUnique.mockResolvedValue(task());
      prisma.binStock.findUnique.mockResolvedValue({ quantity: 5 });

      await service.complete("t1", { completedById: "w1", scannedBinCode: "A-01" });

      expect(inventory.confirmBinLocation).toHaveBeenCalledWith("SKU-1", "A-01", {
        locationCode: "WH-MAIN",
        quantity: 13,
      });
      expect(inventory.confirmBinLocation.mock.invocationCallOrder[0]).toBeLessThan(
        prisma.$transaction.mock.invocationCallOrder[0],
      );
    });

    it("leaves the task open if Inventory rejects the confirmation", async () => {
      prisma.putawayTask.findUnique.mockResolvedValue(task());
      prisma.binStock.findUnique.mockResolvedValue(null);
      inventory.confirmBinLocation.mockRejectedValue(new Error("Inventory unreachable"));

      await expect(
        service.complete("t1", { completedById: "w1", scannedBinCode: "A-01" }),
      ).rejects.toThrow("Inventory unreachable");
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("rejects a task with no bin assigned", async () => {
      prisma.putawayTask.findUnique.mockResolvedValue(task({ bin: null }));

      await expect(
        service.complete("t1", { completedById: "w1", scannedBinCode: "A-01" }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
