import { BadRequestException } from "@nestjs/common";
import { SalesSummaryController } from "../sales-summary.controller";
import { SalesSummaryService } from "../sales-summary.service";

describe("SalesSummaryController", () => {
  let controller: SalesSummaryController;
  let summary: { summarize: jest.Mock };

  beforeEach(() => {
    summary = { summarize: jest.fn().mockResolvedValue({}) };
    controller = new SalesSummaryController(summary as unknown as SalesSummaryService);
  });

  it("summarizes the store over the range", async () => {
    await controller.get("STORE-1", "2026-09-01", "2026-09-14");
    expect(summary.summarize).toHaveBeenCalledWith("STORE-1", "2026-09-01", "2026-09-14");
  });

  it("requires both ends of the range", () => {
    expect(() => controller.get("STORE-1", "2026-09-01", undefined)).toThrow(BadRequestException);
    expect(summary.summarize).not.toHaveBeenCalled();
  });
});
