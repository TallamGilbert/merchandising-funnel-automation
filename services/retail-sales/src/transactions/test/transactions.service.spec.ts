import { NotFoundException } from "@nestjs/common";
import { TransactionsRepository } from "../transactions.repository";
import { TransactionsService } from "../transactions.service";

describe("TransactionsService", () => {
  let service: TransactionsService;
  let transactions: { findByIdWithDetails: jest.Mock; findPage: jest.Mock; count: jest.Mock };

  beforeEach(() => {
    transactions = {
      findByIdWithDetails: jest.fn().mockResolvedValue({ id: "txn-1", lines: [], payments: [], returns: [] }),
      findPage: jest.fn().mockResolvedValue([{ id: "txn-1" }]),
      count: jest.fn().mockResolvedValue(41),
    };
    service = new TransactionsService(transactions as unknown as TransactionsRepository);
  });

  it("returns the transaction with its details", async () => {
    await expect(service.findOne("txn-1")).resolves.toEqual(expect.objectContaining({ id: "txn-1" }));
    expect(transactions.findByIdWithDetails).toHaveBeenCalledWith("txn-1");
  });

  it("rejects an unknown id", async () => {
    transactions.findByIdWithDetails.mockResolvedValue(null);
    await expect(service.findOne("nope")).rejects.toBeInstanceOf(NotFoundException);
  });

  describe("list", () => {
    it("returns one page of sales with the total", async () => {
      await expect(service.list({ page: 3, pageSize: 20 })).resolves.toEqual({
        items: [{ id: "txn-1" }],
        total: 41,
        page: 3,
        pageSize: 20,
      });
      expect(transactions.findPage).toHaveBeenCalledWith(expect.anything(), { skip: 40, take: 20 });
    });

    it("filters by store, cashier, day range and transaction number", async () => {
      await service.list({
        page: 1,
        pageSize: 20,
        storeId: "STORE-1",
        cashierId: "cashier-amy",
        from: "2026-10-01",
        to: "2026-10-01",
        q: "TXN-10",
      });
      expect(transactions.count).toHaveBeenCalledWith({
        storeId: "STORE-1",
        registerId: undefined,
        cashierId: "cashier-amy",
        status: undefined,
        createdAt: { gte: new Date("2026-10-01T00:00:00.000Z"), lt: new Date("2026-10-02T00:00:00.000Z") },
        OR: [{ transactionNumber: { contains: "TXN-10", mode: "insensitive" } }],
      });
    });

    it("returns every matching sale (capped) for an export", async () => {
      await service.list({ page: 2, pageSize: 20, format: "csv" });
      expect(transactions.findPage).toHaveBeenCalledWith(expect.anything(), { skip: 0, take: 50_000 });
    });
  });
});
