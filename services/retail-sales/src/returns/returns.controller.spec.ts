import { BadRequestException } from "@nestjs/common";
import { ReturnsController } from "./returns.controller";
import { ReturnsService } from "./returns.service";

describe("ReturnsController", () => {
  let controller: ReturnsController;
  let returns: { processReturn: jest.Mock };

  const dto = {
    originalTransactionId: "txn-1",
    storeId: "STORE-1",
    registerId: "REG-1",
    lines: [{ transactionLineId: "line-1", quantityReturned: 1 }],
  };

  beforeEach(() => {
    returns = { processReturn: jest.fn().mockResolvedValue({ id: "ret-1" }) };
    controller = new ReturnsController(returns as unknown as ReturnsService);
  });

  it("processes the return from the body", async () => {
    await expect(controller.process(dto)).resolves.toEqual({ id: "ret-1" });
    expect(returns.processReturn).toHaveBeenCalledWith(dto);
  });

  it("passes through the service's validation error", async () => {
    returns.processReturn.mockRejectedValue(new BadRequestException());
    await expect(controller.process(dto)).rejects.toBeInstanceOf(BadRequestException);
  });
});
