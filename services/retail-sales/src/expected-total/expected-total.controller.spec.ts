import { BadRequestException } from "@nestjs/common";
import { ExpectedTotalController } from "./expected-total.controller";
import { ExpectedTotalService } from "./expected-total.service";

describe("ExpectedTotalController", () => {
  let controller: ExpectedTotalController;
  let expectedTotal: { getExpectedTotal: jest.Mock };

  beforeEach(() => {
    expectedTotal = {
      getExpectedTotal: jest.fn().mockResolvedValue({
        storeId: "STORE-1",
        businessDate: "2026-09-24",
        expectedTotal: 78.5,
      }),
    };

    controller = new ExpectedTotalController(expectedTotal as unknown as ExpectedTotalService);
  });

  it("returns the expected total for the store and business date", async () => {
    await expect(controller.get("STORE-1", "2026-09-24")).resolves.toEqual(
      expect.objectContaining({ expectedTotal: 78.5 }),
    );
    expect(expectedTotal.getExpectedTotal).toHaveBeenCalledWith("STORE-1", "2026-09-24");
  });

  it("rejects a request without a businessDate", () => {
    expect(() => controller.get("STORE-1", undefined)).toThrow(BadRequestException);
    expect(expectedTotal.getExpectedTotal).not.toHaveBeenCalled();
  });
});
