import { BadRequestException } from "@nestjs/common";
import { DailyCloseController } from "./daily-close.controller";
import { DailyCloseService } from "./daily-close.service";

describe("DailyCloseController", () => {
  let controller: DailyCloseController;
  let dailyClose: Record<"get" | "recordCount" | "explainDiscrepancy" | "close", jest.Mock>;

  beforeEach(() => {
    dailyClose = {
      get: jest.fn().mockResolvedValue({ id: "close-1" }),
      recordCount: jest.fn().mockResolvedValue({ id: "close-1" }),
      explainDiscrepancy: jest.fn().mockResolvedValue({ id: "close-1" }),
      close: jest.fn().mockResolvedValue({ id: "close-1" }),
    };
    controller = new DailyCloseController(dailyClose as unknown as DailyCloseService);
  });

  it("gets the close for a store and business date", async () => {
    await controller.get("STORE-1", "2026-09-24");
    expect(dailyClose.get).toHaveBeenCalledWith("STORE-1", "2026-09-24");
  });

  it("rejects a get without a businessDate", () => {
    expect(() => controller.get("STORE-1", undefined)).toThrow(BadRequestException);
    expect(dailyClose.get).not.toHaveBeenCalled();
  });

  it("records a physical count", async () => {
    await controller.recordCount("STORE-1", { businessDate: "2026-09-24", actualCountedTotal: 95 });
    expect(dailyClose.recordCount).toHaveBeenCalledWith("STORE-1", "2026-09-24", 95);
  });

  it("records a discrepancy explanation", async () => {
    await controller.explain("STORE-1", { businessDate: "2026-09-24", explanation: "Till miscount" });
    expect(dailyClose.explainDiscrepancy).toHaveBeenCalledWith("STORE-1", "2026-09-24", "Till miscount");
  });

  it("closes the day for the manager", async () => {
    await controller.close("STORE-1", { businessDate: "2026-09-24", closedByManagerId: "mgr-1" });
    expect(dailyClose.close).toHaveBeenCalledWith("STORE-1", "2026-09-24", "mgr-1");
  });
});
