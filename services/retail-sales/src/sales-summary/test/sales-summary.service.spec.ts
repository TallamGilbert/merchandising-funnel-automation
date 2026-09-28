import { BadRequestException } from "@nestjs/common";
import { SalesSummaryRepository } from "../sales-summary.repository";
import { SalesSummaryService } from "../sales-summary.service";

describe("SalesSummaryService", () => {
  let service: SalesSummaryService;
  let repo: { findSales: jest.Mock; findReturns: jest.Mock };

  const sale = (at: string, total: number, lines: [string, string, number, number][], payments: [string, number][]) => ({
    createdAt: new Date(at),
    totalAmount: total,
    lines: lines.map(([sku, productName, quantitySold, lineTotal]) => ({ sku, productName, quantitySold, lineTotal })),
    payments: payments.map(([method, amount]) => ({ method, amount })),
  });

  beforeEach(() => {
    repo = {
      findSales: jest.fn().mockResolvedValue([
        sale("2026-09-24T09:00:00Z", 100, [["CHAIR", "Oak Chair", 2, 100]], [["CASH", 100]]),
        sale("2026-09-24T15:00:00Z", 50.1, [["LAMP", "Lamp", 1, 50.1]], [["CARD", 50.1]]),
        sale("2026-09-26T10:00:00Z", 300, [["SOFA", "Sofa", 1, 250], ["CHAIR", "Oak Chair", 1, 50]], [["CARD", 200], ["CASH", 100]]),
      ]),
      findReturns: jest.fn().mockResolvedValue([{ createdAt: new Date("2026-09-26T12:00:00Z"), refundAmount: 50 }]),
    };
    service = new SalesSummaryService(repo as unknown as SalesSummaryRepository);
  });

  it("queries the whole inclusive UTC range", async () => {
    await service.summarize("STORE-1", "2026-09-24", "2026-09-26");

    const start = new Date("2026-09-24T00:00:00.000Z");
    const end = new Date("2026-09-27T00:00:00.000Z");
    expect(repo.findSales).toHaveBeenCalledWith("STORE-1", start, end);
    expect(repo.findReturns).toHaveBeenCalledWith("STORE-1", start, end);
  });

  it("buckets sales and refunds per day, including days with nothing", async () => {
    const { daily } = await service.summarize("STORE-1", "2026-09-24", "2026-09-26");

    expect(daily).toEqual([
      { date: "2026-09-24", sales: 150.1, returns: 0, transactions: 2 },
      { date: "2026-09-25", sales: 0, returns: 0, transactions: 0 },
      { date: "2026-09-26", sales: 300, returns: 50, transactions: 1 },
    ]);
  });

  it("totals split payments by method, largest first", async () => {
    const { paymentMix } = await service.summarize("STORE-1", "2026-09-24", "2026-09-26");
    expect(paymentMix).toEqual([
      { method: "CARD", amount: 250.1 },
      { method: "CASH", amount: 200 },
    ]);
  });

  it("ranks best sellers by revenue across sales", async () => {
    const { topProducts } = await service.summarize("STORE-1", "2026-09-24", "2026-09-26");
    expect(topProducts[0]).toEqual({ sku: "SOFA", productName: "Sofa", quantity: 1, revenue: 250 });
    expect(topProducts[1]).toEqual({ sku: "CHAIR", productName: "Oak Chair", quantity: 3, revenue: 150 });
  });

  it.each([
    ["2026-9-24", "2026-09-26"],
    ["2026-09-26", "2026-09-24"],
    ["2026-01-01", "2026-12-31"],
  ])("rejects the range %s to %s", async (from, to) => {
    await expect(service.summarize("STORE-1", from, to)).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.findSales).not.toHaveBeenCalled();
  });
});
