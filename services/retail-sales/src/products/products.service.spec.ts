import { NotFoundException } from "@nestjs/common";
import { ProductsRepository } from "./products.repository";
import { ProductsService } from "./products.service";

describe("ProductsService", () => {
  let service: ProductsService;
  let products: {
    findAll: jest.Mock;
    findBySku: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    createPromotion: jest.Mock;
  };

  const promotion = {
    discountPct: 25,
    startsAt: new Date("2026-09-01T00:00:00.000Z"),
    endsAt: new Date("2026-09-30T23:59:59.000Z"),
  };
  const product = {
    id: "prod-1",
    sku: "SKU-1",
    name: "Oak Chair",
    unitPrice: 10,
    taxRatePct: 8,
    promotions: [promotion],
  };

  beforeEach(() => {
    products = {
      findAll: jest.fn().mockResolvedValue([product]),
      findBySku: jest.fn().mockResolvedValue(product),
      create: jest.fn().mockResolvedValue(product),
      update: jest.fn().mockResolvedValue(product),
      createPromotion: jest.fn().mockResolvedValue({ id: "promo-1" }),
    };

    service = new ProductsService(products as unknown as ProductsRepository);
  });

  describe("findOne", () => {
    it("returns the product for a known SKU", async () => {
      await expect(service.findOne("SKU-1")).resolves.toBe(product);
    });

    it("rejects an unknown SKU", async () => {
      products.findBySku.mockResolvedValue(null);
      await expect(service.findOne("NOPE")).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("create", () => {
    it("defaults the tax rate to 0 when none is given", async () => {
      await service.create({ sku: "SKU-2", name: "Pine Stool", unitPrice: 5 });

      expect(products.create).toHaveBeenCalledWith({
        sku: "SKU-2",
        name: "Pine Stool",
        unitPrice: 5,
        taxRatePct: 0,
      });
    });
  });

  describe("update", () => {
    it("updates an existing product", async () => {
      await service.update("SKU-1", { unitPrice: 12 });
      expect(products.update).toHaveBeenCalledWith("SKU-1", { unitPrice: 12 });
    });

    it("rejects an unknown SKU without writing", async () => {
      products.findBySku.mockResolvedValue(null);

      await expect(service.update("NOPE", { unitPrice: 12 })).rejects.toBeInstanceOf(NotFoundException);
      expect(products.update).not.toHaveBeenCalled();
    });
  });

  describe("addPromotion", () => {
    it("attaches the promotion to the product's id with parsed dates", async () => {
      await service.addPromotion("SKU-1", {
        discountPct: 10,
        startsAt: "2026-10-01T00:00:00.000Z",
        endsAt: "2026-10-07T00:00:00.000Z",
      });

      expect(products.createPromotion).toHaveBeenCalledWith({
        productId: "prod-1",
        discountPct: 10,
        startsAt: new Date("2026-10-01T00:00:00.000Z"),
        endsAt: new Date("2026-10-07T00:00:00.000Z"),
      });
    });

    it("rejects an unknown SKU without writing", async () => {
      products.findBySku.mockResolvedValue(null);

      await expect(
        service.addPromotion("NOPE", { discountPct: 10, startsAt: "2026-10-01", endsAt: "2026-10-07" }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(products.createPromotion).not.toHaveBeenCalled();
    });
  });

  describe("getActivePriceAndPromotion", () => {
    it("includes a promotion that covers the given instant", async () => {
      const priced = await service.getActivePriceAndPromotion("SKU-1", new Date("2026-09-15T12:00:00.000Z"));

      expect(priced).toEqual({
        id: "prod-1",
        sku: "SKU-1",
        name: "Oak Chair",
        unitPrice: 10,
        taxRatePct: 8,
        activePromotion: { discountPct: 25 },
      });
    });

    it("treats the promotion's start and end instants as inclusive", async () => {
      const atStart = await service.getActivePriceAndPromotion("SKU-1", promotion.startsAt);
      const atEnd = await service.getActivePriceAndPromotion("SKU-1", promotion.endsAt);

      expect(atStart.activePromotion).toEqual({ discountPct: 25 });
      expect(atEnd.activePromotion).toEqual({ discountPct: 25 });
    });

    it("ignores a promotion outside the given instant", async () => {
      const before = await service.getActivePriceAndPromotion("SKU-1", new Date("2026-08-31T23:59:59.000Z"));
      const after = await service.getActivePriceAndPromotion("SKU-1", new Date("2026-10-01T00:00:00.000Z"));

      expect(before.activePromotion).toBeNull();
      expect(after.activePromotion).toBeNull();
    });

    it("rejects an unknown SKU", async () => {
      products.findBySku.mockResolvedValue(null);
      await expect(service.getActivePriceAndPromotion("NOPE")).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
