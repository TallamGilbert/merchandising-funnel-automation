import { BadRequestException } from "@nestjs/common";
import { AuthUser } from "@mms/shared";
import { CheckoutController } from "../checkout.controller";
import { CheckoutService } from "../checkout.service";

describe("CheckoutController", () => {
  let controller: CheckoutController;
  let checkout: { checkout: jest.Mock };

  const dto = {
    storeId: "STORE-1",
    registerId: "REG-1",
    locationCode: "STORE-1",
    lines: [{ sku: "SKU-1", quantity: 2 }],
    payments: [{ method: "CASH" as const, amount: 21.6 }],
  };

  beforeEach(() => {
    checkout = { checkout: jest.fn().mockResolvedValue({ id: "txn-1" }) };
    controller = new CheckoutController(checkout as unknown as CheckoutService);
  });

  const cashier = { id: "cashier-amy" } as AuthUser;

  it("checks out the cart from the body, recording the signed-in cashier", async () => {
    await expect(controller.process(cashier, dto)).resolves.toEqual({ id: "txn-1" });
    expect(checkout.checkout).toHaveBeenCalledWith({ ...dto, cashierId: "cashier-amy" });
  });

  it("passes through the service's rejection", async () => {
    checkout.checkout.mockRejectedValue(new BadRequestException());
    await expect(controller.process(cashier, dto)).rejects.toBeInstanceOf(BadRequestException);
  });
});
