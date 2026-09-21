import { ConfigService } from "@nestjs/config";
import { EventBusService, EventRoutingKey, StockTransferredEvent } from "@mms/shared";
import { InventoryTransactionType, ReservationStatus } from "../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import { StockService } from "./stock.service";

describe("StockService", () => {
  let service: StockService;
  let prisma: {
    product: Record<string, jest.Mock>;
    stockLevel: Record<string, jest.Mock>;
    reservation: Record<string, jest.Mock>;
    inventoryTransaction: Record<string, jest.Mock>;
    salesVelocity: Record<string, jest.Mock>;
    $transaction: jest.Mock;
  };
  let eventBus: { publish: jest.Mock };

  const product = { id: "product-1", sku: "SKU-1", unitCost: 100 };

  beforeEach(() => {
    prisma = {
      product: { findUnique: jest.fn().mockResolvedValue(product) },
      stockLevel: {
        upsert: jest.fn(),
        update: jest.fn().mockReturnValue("level-update"),
        updateMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        findUnique: jest.fn(),
      },
      reservation: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      inventoryTransaction: {
        create: jest.fn().mockReturnValue("txn-create"),
        findFirst: jest.fn().mockResolvedValue(null),
        aggregate: jest.fn().mockResolvedValue({ _sum: { quantityDelta: 0 } }),
      },
      salesVelocity: { create: jest.fn() },
      $transaction: jest.fn(),
    };
    eventBus = { publish: jest.fn() };
    const config = { get: jest.fn().mockReturnValue("7") };

    service = new StockService(
      prisma as unknown as PrismaService,
      eventBus as unknown as EventBusService,
      config as unknown as ConfigService,
    );
  });

  describe("reserve", () => {
    it("declines the reservation when available stock is insufficient", async () => {
      prisma.stockLevel.findUniqueOrThrow.mockResolvedValue({
        id: "level-1",
        onHand: 5,
        allocated: 5,
      });

      const result = await service.reserve("SKU-1", "STORE-1", 1, "txn-1");

      expect(result.available).toBe(false);
      expect(prisma.reservation.create).not.toHaveBeenCalled();
    });

    it("creates a reservation and increments allocated when stock is available", async () => {
      prisma.stockLevel.findUniqueOrThrow.mockResolvedValue({
        id: "level-1",
        onHand: 10,
        allocated: 2,
      });
      prisma.reservation.create.mockResolvedValue({ id: "reservation-1" });

      const result = await service.reserve("SKU-1", "STORE-1", 3, "txn-1");

      expect(result).toEqual({
        available: true,
        quantityReserved: 3,
        availableQuantityAfterReservation: 5,
        reservationId: "reservation-1",
      });
      expect(prisma.stockLevel.update).toHaveBeenCalledWith({
        where: { id: "level-1" },
        data: { allocated: { increment: 3 } },
      });
    });
  });

  describe("consumeReservationForSale", () => {
    it("does nothing when the reservation is not active", async () => {
      prisma.reservation.findUnique.mockResolvedValue({
        id: "reservation-1",
        status: ReservationStatus.RELEASED,
      });

      await service.consumeReservationForSale("reservation-1", 1, "txn-1");

      expect(prisma.stockLevel.updateMany).not.toHaveBeenCalled();
    });

    it("decrements onHand and allocated, and publishes StockLow when the threshold is crossed", async () => {
      prisma.reservation.findUnique.mockResolvedValue({
        id: "reservation-1",
        productId: "product-1",
        locationCode: "STORE-1",
        quantity: 1,
        status: ReservationStatus.ACTIVE,
      });
      // 14 units sold over the 14-day window => velocity 1/day => threshold ceil(1*7)=7
      prisma.inventoryTransaction.aggregate.mockResolvedValue({
        _sum: { quantityDelta: -14 },
      });
      prisma.stockLevel.findUnique.mockResolvedValue({
        onHand: 5,
        allocated: 0,
      });

      await service.consumeReservationForSale("reservation-1", 1, "txn-1");

      expect(prisma.stockLevel.updateMany).toHaveBeenCalledWith({
        where: { productId: "product-1", locationCode: "STORE-1" },
        data: { onHand: { decrement: 1 }, allocated: { decrement: 1 } },
      });
      expect(prisma.inventoryTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ type: InventoryTransactionType.SALE }),
      });
      expect(eventBus.publish).toHaveBeenCalledWith(
        EventRoutingKey.STOCK_LOW,
        expect.objectContaining({ sku: "SKU-1", dynamicReorderThreshold: 7 }),
      );
    });
  });

  describe("applyStockTransfer (D-7)", () => {
    const event: StockTransferredEvent = {
      eventId: "e1",
      occurredAt: "2026-09-21T08:00:00.000Z",
      transferNumber: "TRF-1001",
      sku: "SKU-1",
      quantity: 10,
      fromLocationCode: "WH-MAIN",
      toLocationCode: "STORE-1",
    };

    it("moves On Hand from the source to the destination and writes a ledger pair", async () => {
      prisma.stockLevel.findUnique.mockResolvedValue({ onHand: 50, allocated: 0 });

      await service.applyStockTransfer(event);

      expect(prisma.stockLevel.update).toHaveBeenCalledWith({
        where: { productId_locationCode: { productId: "product-1", locationCode: "WH-MAIN" } },
        data: { onHand: { decrement: 10 } },
      });
      expect(prisma.stockLevel.update).toHaveBeenCalledWith({
        where: { productId_locationCode: { productId: "product-1", locationCode: "STORE-1" } },
        data: { onHand: { increment: 10 } },
      });
      expect(prisma.inventoryTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          locationCode: "WH-MAIN",
          type: InventoryTransactionType.TRANSFER_OUT,
          quantityDelta: -10,
          referenceId: "TRF-1001",
        }),
      });
      expect(prisma.inventoryTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          locationCode: "STORE-1",
          type: InventoryTransactionType.TRANSFER_IN,
          quantityDelta: 10,
          referenceId: "TRF-1001",
        }),
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it("applies a redelivered transfer only once", async () => {
      prisma.inventoryTransaction.findFirst.mockResolvedValue({ id: "txn-1" });

      await service.applyStockTransfer(event);

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.stockLevel.update).not.toHaveBeenCalled();
    });

    it("still records stock that physically moved when the source count had drifted low", async () => {
      prisma.stockLevel.findUnique.mockResolvedValue({ onHand: 4, allocated: 0 });

      await service.applyStockTransfer(event);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it("skips a transfer for an unknown SKU", async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await service.applyStockTransfer(event);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
