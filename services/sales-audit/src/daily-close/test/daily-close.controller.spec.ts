import { BadRequestException } from "@nestjs/common";
import { AuthUser } from "@mms/shared";
import { DailyCloseController } from "../daily-close.controller";
import { DailyCloseService } from "../daily-close.service";

describe("DailyCloseController", () => {
  let controller: DailyCloseController;
  let dailyClose: Record<"get" | "openDays" | "recordCount" | "explainDiscrepancy" | "close", jest.Mock>;

  beforeEach(() => {
    dailyClose = {
      get: jest.fn().mockResolvedValue({ id: "close-1" }),
      openDays: jest.fn().mockResolvedValue({ storeId: "STORE-1", businessDates: [] }),
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

  it("lists a store's unclosed days", async () => {
    await controller.openDays("STORE-1");
    expect(dailyClose.openDays).toHaveBeenCalledWith("STORE-1");
  });

  it("records a physical count", async () => {
    await controller.recordCount("STORE-1", { businessDate: "2026-09-24", actualCountedTotal: 95 });
    expect(dailyClose.recordCount).toHaveBeenCalledWith("STORE-1", "2026-09-24", 95);
  });

  it("records a discrepancy explanation", async () => {
    await controller.explain("STORE-1", { businessDate: "2026-09-24", explanation: "Till miscount" });
    expect(dailyClose.explainDiscrepancy).toHaveBeenCalledWith("STORE-1", "2026-09-24", "Till miscount");
  });

  it("closes the day as the signed-in manager", async () => {
    await controller.close({ id: "mgr-1" } as AuthUser, "STORE-1", { businessDate: "2026-09-24" });
    expect(dailyClose.close).toHaveBeenCalledWith("STORE-1", "2026-09-24", "mgr-1");
  });
});
