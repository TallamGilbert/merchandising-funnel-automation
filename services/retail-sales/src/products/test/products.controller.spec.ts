import { NotFoundException } from "@nestjs/common";
import { ProductsController } from "../products.controller";
import { ProductsService } from "../products.service";

describe("ProductsController", () => {
  let controller: ProductsController;
  let products: Record<"list" | "create" | "findOne" | "update" | "addPromotion", jest.Mock>;

  beforeEach(() => {
    products = {
      list: jest.fn().mockResolvedValue([{ sku: "SKU-1" }]),
      create: jest.fn().mockResolvedValue({ sku: "SKU-2" }),
      findOne: jest.fn().mockResolvedValue({ sku: "SKU-1" }),
      update: jest.fn().mockResolvedValue({ sku: "SKU-1" }),
      addPromotion: jest.fn().mockResolvedValue({ id: "promo-1" }),
    };

    controller = new ProductsController(products as unknown as ProductsService);
  });

  it("lists products", async () => {
    await expect(controller.list()).resolves.toEqual([{ sku: "SKU-1" }]);
  });

  it("creates a product from the body", async () => {
    const dto = { sku: "SKU-2", name: "Pine Stool", unitPrice: 5 };

    await expect(controller.create(dto)).resolves.toEqual({ sku: "SKU-2" });
    expect(products.create).toHaveBeenCalledWith(dto);
  });

  it("finds one product by SKU", async () => {
    await controller.findOne("SKU-1");
    expect(products.findOne).toHaveBeenCalledWith("SKU-1");
  });

  it("passes through the service's not-found error", async () => {
    products.findOne.mockRejectedValue(new NotFoundException());
    await expect(controller.findOne("NOPE")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("updates a product by SKU", async () => {
    await controller.update("SKU-1", { unitPrice: 12 });
    expect(products.update).toHaveBeenCalledWith("SKU-1", { unitPrice: 12 });
  });

  it("adds a promotion to a product by SKU", async () => {
    const dto = { discountPct: 10, startsAt: "2026-10-01", endsAt: "2026-10-07" };

    await controller.addPromotion("SKU-1", dto);
    expect(products.addPromotion).toHaveBeenCalledWith("SKU-1", dto);
  });
});
