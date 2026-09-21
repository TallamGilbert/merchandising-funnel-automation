import { NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { StockService } from "../stock/stock.service";
import { ProductsService } from "./products.service";

describe("ProductsService", () => {
  let service: ProductsService;
  let prisma: {
    product: Record<string, jest.Mock>;
    binLocation: Record<string, jest.Mock>;
  };

  beforeEach(() => {
    prisma = {
      product: { findUnique: jest.fn().mockResolvedValue({ id: "p1", sku: "SKU-1" }) },
      binLocation: { upsert: jest.fn(), deleteMany: jest.fn(), findMany: jest.fn() },
    };
    service = new ProductsService(
      prisma as unknown as PrismaService,
      {} as unknown as StockService,
    );
  });

  describe("setBinLocation", () => {
    it("records the bin's absolute quantity, so a retry cannot double-count", async () => {
      await service.setBinLocation("SKU-1", "A-01", { locationCode: "WH-MAIN", quantity: 13 });

      expect(prisma.binLocation.upsert).toHaveBeenCalledWith({
        where: { productId_binCode: { productId: "p1", binCode: "A-01" } },
        create: { productId: "p1", binCode: "A-01", locationCode: "WH-MAIN", quantity: 13 },
        update: { locationCode: "WH-MAIN", quantity: 13 },
      });
    });

    it("removes the record when the bin is emptied", async () => {
      await service.setBinLocation("SKU-1", "A-01", { locationCode: "WH-MAIN", quantity: 0 });

      expect(prisma.binLocation.deleteMany).toHaveBeenCalledWith({
        where: { productId: "p1", binCode: "A-01" },
      });
      expect(prisma.binLocation.upsert).not.toHaveBeenCalled();
    });

    it("throws NotFoundException for an unknown SKU", async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(
        service.setBinLocation("nope", "A-01", { locationCode: "WH-MAIN", quantity: 1 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
