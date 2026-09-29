import { BadRequestException } from "@nestjs/common";
import { Prisma } from "../../generated/prisma";
import { InboxRepository } from "../../inbox/inbox.repository";
import { LedgerRepository } from "../../ledger/ledger.repository";
import { PayablesRepository } from "../../payables/payables.repository";
import { ReportsService, rollUp } from "../reports.service";

const fact = (businessDate: string, storeId: string, sku: string, quantity: number, revenue: number, cogs: number) => ({
  businessDate,
  storeId,
  sku,
  productName: sku === "CHAIR" ? "Oak Chair" : "Lamp",
  quantity,
  revenue,
  cogs,
});

const FACTS = [
  fact("2026-09-24", "STORE-1", "CHAIR", 2, 200, 120),
  fact("2026-09-24", "STORE-2", "LAMP", 1, 50, 20),
  fact("2026-09-26", "STORE-1", "CHAIR", -1, -100, -60), // a return
];

describe("rollUp", () => {
  it("nets returns off sales per product", () => {
    expect(rollUp(FACTS, "product")).toEqual(
      expect.arrayContaining([
        { key: "CHAIR", label: "Oak Chair", quantity: 1, revenue: 100, cogs: 60, grossProfit: 40, marginPct: 40 },
        { key: "LAMP", label: "Lamp", quantity: 1, revenue: 50, cogs: 20, grossProfit: 30, marginPct: 60 },
      ]),
    );
  });

  it("groups by store", () => {
    const rows = rollUp(FACTS, "store");
    expect(rows.find((r) => r.key === "STORE-1")).toEqual(expect.objectContaining({ revenue: 100, grossProfit: 40 }));
  });

  it("has no margin without revenue", () => {
    expect(rollUp([fact("2026-09-24", "S", "CHAIR", 0, 0, 0)], "product")[0].marginPct).toBeNull();
  });
});

describe("ReportsService", () => {
  let service: ReportsService;
  let ledger: { findSaleFactsBetween: jest.Mock; cashOverShort: jest.Mock };
  let payables: { findAll: jest.Mock };
  let inbox: { countByStatus: jest.Mock };

  beforeEach(() => {
    ledger = {
      findSaleFactsBetween: jest.fn().mockResolvedValue(FACTS),
      cashOverShort: jest.fn().mockResolvedValue(new Prisma.Decimal(50)),
    };
    payables = {
      findAll: jest.fn().mockResolvedValue([
        { amount: 995, dueDate: new Date("2020-01-01T00:00:00Z") },
        { amount: 100, dueDate: new Date("2999-01-01T00:00:00Z") },
      ]),
    };
    inbox = { countByStatus: jest.fn().mockResolvedValue([{ status: "NEEDS_ATTENTION", _count: { _all: 2 } }]) };
    service = new ReportsService(
      ledger as unknown as LedgerRepository,
      payables as unknown as PayablesRepository,
      inbox as unknown as InboxRepository,
    );
  });

  it("reports the range inclusively and totals the whole business", async () => {
    const report = await service.profitability("2026-09-24", "2026-09-26", "product");

    expect(ledger.findSaleFactsBetween).toHaveBeenCalledWith(
      new Date("2026-09-24T00:00:00Z"),
      new Date("2026-09-27T00:00:00Z"),
    );
    expect(report.rows.map((r) => r.key)).toEqual(["CHAIR", "LAMP"]);
    expect(report.total).toEqual(expect.objectContaining({ label: "Whole business", revenue: 150, cogs: 80, grossProfit: 70 }));
  });

  it("fills every day in a by-day report", async () => {
    const report = await service.profitability("2026-09-24", "2026-09-26", "day");
    expect(report.rows.map((r) => [r.key, r.revenue])).toEqual([
      ["2026-09-24", 250],
      ["2026-09-25", 0],
      ["2026-09-26", -100],
    ]);
  });

  it("rejects backwards or malformed ranges", async () => {
    await expect(service.profitability("2026-09-26", "2026-09-24", "day")).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.profitability("26-09-2026", "2026-09-24", "day")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("summarises profit, payables, cash over/short and posting problems", async () => {
    const summary = await service.summary("2026-09-24", "2026-09-26");

    expect(summary).toEqual(
      expect.objectContaining({
        revenue: 150,
        grossProfit: 70,
        cashOverShort: 50,
        payables: { outstanding: 1095, openBills: 2, overdue: 995, overdueBills: 1 },
        inbox: { pending: 0, needsAttention: 2 },
      }),
    );
    expect(summary.daily).toHaveLength(3);
  });
});
