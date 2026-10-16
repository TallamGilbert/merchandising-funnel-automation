import { Injectable, NotFoundException } from "@nestjs/common";
import { dateRange, pageArgs, paged, searchAny } from "@mms/shared";
import { ListTransactionsQuery } from "./list-transactions.query";
import { TransactionsRepository } from "./transactions.repository";

@Injectable()
export class TransactionsService {
  constructor(private readonly transactions: TransactionsRepository) {}

  async list(query: ListTransactionsQuery) {
    const where = {
      storeId: query.storeId,
      registerId: query.registerId,
      cashierId: query.cashierId,
      status: query.status,
      createdAt: dateRange(query.from, query.to),
      ...searchAny(query.q, ["transactionNumber"]),
    };
    const [items, total] = await Promise.all([
      this.transactions.findPage(where, pageArgs(query)),
      this.transactions.count(where),
    ]);
    return paged(items, total, query);
  }

  async findOne(id: string) {
    const transaction = await this.transactions.findByIdWithDetails(id);
    if (!transaction) throw new NotFoundException(`Transaction ${id} not found`);
    return transaction;
  }
}
