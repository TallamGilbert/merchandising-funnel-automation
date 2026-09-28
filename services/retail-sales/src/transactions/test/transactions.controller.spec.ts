import { NotFoundException } from "@nestjs/common";
import { TransactionsController } from "../transactions.controller";
import { TransactionsService } from "../transactions.service";

describe("TransactionsController", () => {
  let controller: TransactionsController;
  let transactions: { findOne: jest.Mock; listRecent: jest.Mock };

  beforeEach(() => {
    transactions = {
      findOne: jest.fn().mockResolvedValue({ id: "txn-1" }),
      listRecent: jest.fn().mockResolvedValue([]),
    };
    controller = new TransactionsController(transactions as unknown as TransactionsService);
  });

  it("lists recent transactions for a store", async () => {
    await controller.list("STORE-1", 20);
    expect(transactions.listRecent).toHaveBeenCalledWith("STORE-1", 20);
  });

  it("returns the transaction by id", async () => {
    await expect(controller.findOne("txn-1")).resolves.toEqual({ id: "txn-1" });
    expect(transactions.findOne).toHaveBeenCalledWith("txn-1");
  });

  it("passes through the service's not-found error", async () => {
    transactions.findOne.mockRejectedValue(new NotFoundException());
    await expect(controller.findOne("nope")).rejects.toBeInstanceOf(NotFoundException);
  });
});
