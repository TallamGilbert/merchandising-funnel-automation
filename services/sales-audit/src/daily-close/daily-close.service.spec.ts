import { BadRequestException } from "@nestjs/common";
import { EventBusService, EventRoutingKey } from "@mms/shared";
import { DailyCloseStatus } from "../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import { LedgerService } from "../item-sold-ledger/ledger.service";
import { RetailSalesClientService } from "../retail-sales-client/retail-sales-client.service";
import { DailyCloseService } from "./daily-close.service";

describe("DailyCloseService", () => {
  let service: DailyCloseService;
  let prisma: {
    dailyClose: Record<string, jest.Mock>;
    discrepancyLogEntry: Record<string, jest.Mock>;
    $transaction: jest.Mock;
  };
  let ledger: { ensureLedger: jest.Mock };
  let retailSales: { getExpectedTotal: jest.Mock };
  let eventBus: { publish: jest.Mock };

  beforeEach(() => {
    prisma = {
      dailyClose: {
        findFirst: jest.fn(),
        upsert: jest.fn().mockImplementation(({ create }) => Promise.resolve({ id: "close-1", ...create })),
        update: jest.fn().mockReturnValue("close-update"),
      },
      discrepancyLogEntry: { create: jest.fn().mockReturnValue("log-create") },
      $transaction: jest.fn().mockResolvedValue([{}, {}]),
    };
    ledger = { ensureLedger: jest.fn().mockResolvedValue({ id: "ledger-1", expectedTotal: 100 }) };
    retailSales = { getExpectedTotal: jest.fn().mockResolvedValue({ expectedTotal: 100 }) };
    eventBus = { publish: jest.fn() };

    service = new DailyCloseService(
      prisma as unknown as PrismaService,
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
      prisma.dailyClose.findFirst.mockResolvedValue({
        id: "close-1",
        status: DailyCloseStatus.BLOCKED_ON_EXPLANATION,
      });

      await service.explainDiscrepancy("STORE-1", "2026-09-24", "Till miscount, corrected on recount");

      expect(prisma.dailyClose.update).toHaveBeenCalledWith({
        where: { id: "close-1" },
        data: { discrepancyExplanation: "Till miscount, corrected on recount", status: DailyCloseStatus.OPEN },
      });
    });
  });

  describe("close", () => {
    it("rejects while blocked on an unexplained discrepancy", async () => {
      prisma.dailyClose.findFirst.mockResolvedValue({
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
      prisma.dailyClose.findFirst.mockResolvedValue(null);

      await expect(service.close("STORE-1", "2026-09-24", "mgr-1")).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it("writes the discrepancy log and publishes DayClosed with the correct sign convention", async () => {
      prisma.dailyClose.findFirst.mockResolvedValue({
        id: "close-1",
        expectedTotal: 100,
        actualCountedTotal: 95,
        discrepancyAmount: -5,
        discrepancyExplanation: "Till miscount",
        status: DailyCloseStatus.OPEN,
      });

      await service.close("STORE-1", "2026-09-24", "mgr-1");

      expect(prisma.discrepancyLogEntry.create).toHaveBeenCalledWith({
        data: {
          storeId: "STORE-1",
          businessDate: "2026-09-24",
          discrepancyAmount: -5,
          explanation: "Till miscount",
        },
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
