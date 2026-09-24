import { BadRequestException } from "@nestjs/common";
import { EventBusService, EventRoutingKey } from "@mms/shared";
import { PrismaService } from "../prisma/prisma.service";
import { ProductsService } from "../products/products.service";
import { InventoryGrpcClientService } from "../inventory-grpc-client/inventory-grpc-client.service";
import { CheckoutService } from "./checkout.service";

describe("CheckoutService", () => {
  let service: CheckoutService;
  let prisma: { transaction: Record<string, jest.Mock>; $queryRaw: jest.Mock };
  let products: { getActivePriceAndPromotion: jest.Mock };
  let inventory: { checkAndReserveStock: jest.Mock; releaseReservation: jest.Mock };
  let eventBus: { publish: jest.Mock };

  const dto = {
    storeId: "STORE-1",
    registerId: "REG-1",
    cashierId: "cashier-amy",
    locationCode: "STORE-1",
    lines: [{ sku: "SKU-1", quantity: 2 }],
    payments: [{ method: "CASH" as const, amount: 21.6 }],
  };

  beforeEach(() => {
    prisma = {
      transaction: {
        create: jest.fn().mockResolvedValue({ id: "txn-1", lines: [], payments: [] }),
      },
      $queryRaw: jest.fn().mockResolvedValue([{ nextval: BigInt(1) }]),
    };
    products = {
      getActivePriceAndPromotion: jest.fn().mockResolvedValue({
        id: "prod-1",
        sku: "SKU-1",
        name: "Oak Chair",
        unitPrice: 10,
        taxRatePct: 8,
        activePromotion: null,
      }),
    };
    inventory = {
      checkAndReserveStock: jest.fn().mockResolvedValue({
        available: true,
        quantityReserved: 2,
        availableQuantityAfterReservation: 8,
        reservationId: "res-1",
      }),
      releaseReservation: jest.fn().mockResolvedValue(true),
    };
    eventBus = { publish: jest.fn() };

    service = new CheckoutService(
      prisma as unknown as PrismaService,
      products as unknown as ProductsService,
      inventory as unknown as InventoryGrpcClientService,
      eventBus as unknown as EventBusService,
    );
  });

  it("reserves stock, writes the transaction, and publishes ItemSold", async () => {
    await service.checkout(dto);

    expect(inventory.checkAndReserveStock).toHaveBeenCalledWith(
      expect.objectContaining({ sku: "SKU-1", locationCode: "STORE-1", quantityRequested: 2 }),
    );
    expect(prisma.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          transactionNumber: "TXN-1001",
          storeId: "STORE-1",
          totalAmount: 21.6,
          lines: {
            create: [
              expect.objectContaining({
                sku: "SKU-1",
                quantitySold: 2,
                unitPrice: 10,
                discountAmount: 0,
                taxAmount: 1.6,
                lineTotal: 21.6,
                reservationId: "res-1",
              }),
            ],
          },
        }),
      }),
    );
    expect(eventBus.publish).toHaveBeenCalledWith(
      EventRoutingKey.ITEM_SOLD,
      expect.objectContaining({
        storeId: "STORE-1",
        totalAmount: 21.6,
        lines: [expect.objectContaining({ sku: "SKU-1", reservationId: "res-1" })],
      }),
    );
  });

  it("releases already-taken reservations and rejects when a later line is unavailable", async () => {
    const twoLineDto = {
      ...dto,
      lines: [
        { sku: "SKU-1", quantity: 2 },
        { sku: "SKU-2", quantity: 1 },
      ],
    };
    inventory.checkAndReserveStock
      .mockResolvedValueOnce({ available: true, quantityReserved: 2, availableQuantityAfterReservation: 8, reservationId: "res-1" })
      .mockResolvedValueOnce({ available: false, quantityReserved: 0, availableQuantityAfterReservation: 0, reservationId: "" });

    await expect(service.checkout(twoLineDto)).rejects.toBeInstanceOf(BadRequestException);

    expect(inventory.releaseReservation).toHaveBeenCalledWith("res-1");
    expect(prisma.transaction.create).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it("releases reservations and rejects when payments don't sum to the total", async () => {
    const mismatched = { ...dto, payments: [{ method: "CASH" as const, amount: 5 }] };

    await expect(service.checkout(mismatched)).rejects.toBeInstanceOf(BadRequestException);

    expect(inventory.releaseReservation).toHaveBeenCalledWith("res-1");
    expect(prisma.transaction.create).not.toHaveBeenCalled();
  });
});
