import { NotFoundException } from "@nestjs/common";
import { TransactionsRepository } from "../transactions.repository";
import { TransactionsService } from "../transactions.service";

describe("TransactionsService", () => {
  let service: TransactionsService;
  let transactions: { findByIdWithDetails: jest.Mock; findRecent: jest.Mock };

  beforeEach(() => {
    transactions = {
      findByIdWithDetails: jest.fn().mockResolvedValue({ id: "txn-1", lines: [], payments: [], returns: [] }),
      findRecent: jest.fn().mockResolvedValue([]),
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

  describe("listRecent", () => {
    it("lists the 50 most recent sales by default", async () => {
      await service.listRecent();
      expect(transactions.findRecent).toHaveBeenCalledWith({ storeId: undefined, take: 50 });
    });

    it("narrows to one store", async () => {
      await service.listRecent("STORE-1", 10);
      expect(transactions.findRecent).toHaveBeenCalledWith({ storeId: "STORE-1", take: 10 });
    });

    it("clamps the limit between 1 and 200", async () => {
      await service.listRecent(undefined, 5000);
      expect(transactions.findRecent).toHaveBeenLastCalledWith({ storeId: undefined, take: 200 });

      await service.listRecent(undefined, -3);
      expect(transactions.findRecent).toHaveBeenLastCalledWith({ storeId: undefined, take: 1 });
    });
  });
});
