import { BadRequestException } from "@nestjs/common";
import { CheckoutController } from "./checkout.controller";
import { CheckoutService } from "./checkout.service";

describe("CheckoutController", () => {
  let controller: CheckoutController;
  let checkout: { checkout: jest.Mock };

  const dto = {
    storeId: "STORE-1",
    registerId: "REG-1",
    cashierId: "cashier-amy",
    locationCode: "STORE-1",
    lines: [{ sku: "SKU-1", quantity: 2 }],
    payments: [{ method: "CASH" as const, amount: 21.6 }],
  };

  beforeEach(() => {
    checkout = { checkout: jest.fn().mockResolvedValue({ id: "txn-1" }) };
    controller = new CheckoutController(checkout as unknown as CheckoutService);
  });

  it("checks out the cart from the body", async () => {
    await expect(controller.process(dto)).resolves.toEqual({ id: "txn-1" });
    expect(checkout.checkout).toHaveBeenCalledWith(dto);
  });

  it("passes through the service's rejection", async () => {
    checkout.checkout.mockRejectedValue(new BadRequestException());
    await expect(controller.process(dto)).rejects.toBeInstanceOf(BadRequestException);
  });
});
