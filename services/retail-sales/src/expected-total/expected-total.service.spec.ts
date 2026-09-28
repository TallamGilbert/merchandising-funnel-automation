import { ReturnsRepository } from "../returns/returns.repository";
import { TransactionsRepository } from "../transactions/transactions.repository";
import { ExpectedTotalService } from "./expected-total.service";

describe("ExpectedTotalService", () => {
  let service: ExpectedTotalService;
  let transactions: { sumTotalForStore: jest.Mock };
  let returns: { sumRefundsForStore: jest.Mock };

  beforeEach(() => {
    transactions = { sumTotalForStore: jest.fn().mockResolvedValue(0) };
    returns = { sumRefundsForStore: jest.fn().mockResolvedValue(0) };

    service = new ExpectedTotalService(
      transactions as unknown as TransactionsRepository,
      returns as unknown as ReturnsRepository,
    );
  });

  it("sums sales and refunds over the business date's UTC day", async () => {
    await service.getExpectedTotal("STORE-1", "2026-09-24");

    const start = new Date("2026-09-24T00:00:00.000Z");
    const end = new Date("2026-09-25T00:00:00.000Z");
    expect(transactions.sumTotalForStore).toHaveBeenCalledWith("STORE-1", start, end);
    expect(returns.sumRefundsForStore).toHaveBeenCalledWith("STORE-1", start, end);
  });

  it("rolls the day boundary over a month end", async () => {
    await service.getExpectedTotal("STORE-1", "2026-09-30");

    expect(transactions.sumTotalForStore).toHaveBeenCalledWith(
      "STORE-1",
      new Date("2026-09-30T00:00:00.000Z"),
      new Date("2026-10-01T00:00:00.000Z"),
    );
  });

  it("returns sales minus refunds, rounded to cents", async () => {
    transactions.sumTotalForStore.mockResolvedValue(100.1);
    returns.sumRefundsForStore.mockResolvedValue(21.6);

    await expect(service.getExpectedTotal("STORE-1", "2026-09-24")).resolves.toEqual({
      storeId: "STORE-1",
      businessDate: "2026-09-24",
      expectedTotal: 78.5,
    });
  });

  it("returns zero for a day with no sales", async () => {
    const result = await service.getExpectedTotal("STORE-1", "2026-09-24");
    expect(result.expectedTotal).toBe(0);
  });
});
