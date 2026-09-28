import { NotFoundException } from "@nestjs/common";
import { TransactionsRepository } from "./transactions.repository";
import { TransactionsService } from "./transactions.service";

describe("TransactionsService", () => {
  let service: TransactionsService;
  let transactions: { findByIdWithDetails: jest.Mock };

  beforeEach(() => {
    transactions = {
      findByIdWithDetails: jest.fn().mockResolvedValue({ id: "txn-1", lines: [], payments: [], returns: [] }),
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
});
