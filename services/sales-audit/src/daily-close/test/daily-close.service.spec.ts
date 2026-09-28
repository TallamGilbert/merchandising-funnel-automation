import { BadRequestException } from "@nestjs/common";
import { EventBusService, EventRoutingKey } from "@mms/shared";
import { DailyCloseStatus } from "../../generated/prisma";
import { LedgerService } from "../../item-sold-ledger/ledger.service";
import { RetailSalesClientService } from "../../retail-sales-client/retail-sales-client.service";
import { DailyCloseRepository } from "../daily-close.repository";
import { DailyCloseService } from "../daily-close.service";

describe("DailyCloseService", () => {
  let service: DailyCloseService;
  let closes: {
    findByStoreDay: jest.Mock;
    saveCount: jest.Mock;
    update: jest.Mock;
    closeWithLogEntry: jest.Mock;
  };
  let ledger: { ensureLedger: jest.Mock };
  let retailSales: { getExpectedTotal: jest.Mock };
  let eventBus: { publish: jest.Mock };

  beforeEach(() => {
    closes = {
      findByStoreDay: jest.fn(),
      saveCount: jest.fn().mockImplementation((count) => Promise.resolve({ id: "close-1", ...count })),
      update: jest.fn().mockResolvedValue({}),
      closeWithLogEntry: jest.fn().mockResolvedValue(undefined),
    };
    ledger = { ensureLedger: jest.fn().mockResolvedValue({ id: "ledger-1", expectedTotal: 100 }) };
    retailSales = { getExpectedTotal: jest.fn().mockResolvedValue({ expectedTotal: 100 }) };
    eventBus = { publish: jest.fn() };

    service = new DailyCloseService(
      closes as unknown as DailyCloseRepository,
      ledger as unknown as LedgerService,
      retailSales as unknown as RetailSalesClientService,
      eventBus as unknown as EventBusService,
    );
  });

  describe("recordCount", () => {
    it("opens (no block) when the physical count matches the expected total", async () => {
      const result = await service.recordCount("STORE-1", "2026-09-24", 100);

      expect(result.status).toBe(DailyCloseStatus.OPEN);
      expect(result.discrepancyAmount).toBe(0);
    });

    it("blocks on a nonzero discrepancy", async () => {
      const result = await service.recordCount("STORE-1", "2026-09-24", 95);

      expect(result.status).toBe(DailyCloseStatus.BLOCKED_ON_EXPLANATION);
      expect(result.discrepancyAmount).toBe(-5);
    });

    it("uses Retail Sales' cross-checked total over the local ledger accumulator", async () => {
      ledger.ensureLedger.mockResolvedValue({ id: "ledger-1", expectedTotal: 90 });
      retailSales.getExpectedTotal.mockResolvedValue({ expectedTotal: 100 });

      const result = await service.recordCount("STORE-1", "2026-09-24", 100);

      expect(result.expectedTotal).toBe(100);
      expect(result.discrepancyAmount).toBe(0);
    });

    it("falls back to the local ledger if Retail Sales is unreachable", async () => {
      retailSales.getExpectedTotal.mockRejectedValue(new Error("down"));

      const result = await service.recordCount("STORE-1", "2026-09-24", 100);

      expect(result.expectedTotal).toBe(100);
    });
  });

  describe("explainDiscrepancy", () => {
    it("flips a blocked close back to open once explained", async () => {
      closes.findByStoreDay.mockResolvedValue({
        id: "close-1",
        status: DailyCloseStatus.BLOCKED_ON_EXPLANATION,
      });

      await service.explainDiscrepancy("STORE-1", "2026-09-24", "Till miscount, corrected on recount");

      expect(closes.update).toHaveBeenCalledWith("close-1", {
        discrepancyExplanation: "Till miscount, corrected on recount",
        status: DailyCloseStatus.OPEN,
      });
    });
  });

  describe("close", () => {
    it("rejects while blocked on an unexplained discrepancy", async () => {
      closes.findByStoreDay.mockResolvedValue({
        id: "close-1",
        actualCountedTotal: 95,
        status: DailyCloseStatus.BLOCKED_ON_EXPLANATION,
      });

      await expect(service.close("STORE-1", "2026-09-24", "mgr-1")).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it("rejects when no count has been recorded yet", async () => {
      closes.findByStoreDay.mockResolvedValue(null);

      await expect(service.close("STORE-1", "2026-09-24", "mgr-1")).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it("writes the discrepancy log and publishes DayClosed with the correct sign convention", async () => {
      closes.findByStoreDay.mockResolvedValue({
        id: "close-1",
        expectedTotal: 100,
        actualCountedTotal: 95,
        discrepancyAmount: -5,
        discrepancyExplanation: "Till miscount",
        status: DailyCloseStatus.OPEN,
      });

      await service.close("STORE-1", "2026-09-24", "mgr-1");

      expect(closes.closeWithLogEntry).toHaveBeenCalledWith("close-1", "mgr-1", {
        storeId: "STORE-1",
        businessDate: "2026-09-24",
        discrepancyAmount: -5,
        explanation: "Till miscount",
      });
      expect(eventBus.publish).toHaveBeenCalledWith(
        EventRoutingKey.DAY_CLOSED,
        expect.objectContaining({
          storeId: "STORE-1",
          businessDate: "2026-09-24",
          expectedTotal: 100,
          actualCountedTotal: 95,
          discrepancyAmount: -5,
          discrepancyExplanation: "Till miscount",
          closedByManagerId: "mgr-1",
        }),
      );
    });
  });
});
