import { Injectable, NotFoundException } from "@nestjs/common";
import { TransactionsRepository } from "./transactions.repository";

@Injectable()
export class TransactionsService {
  constructor(private readonly transactions: TransactionsRepository) {}

  static readonly MAX_RECENT = 200;

  listRecent(storeId?: string, limit = 50) {
    const take = Math.min(Math.max(Math.trunc(limit) || 50, 1), TransactionsService.MAX_RECENT);
    return this.transactions.findRecent({ storeId, take });
  }

  async findOne(id: string) {
    const transaction = await this.transactions.findByIdWithDetails(id);
    if (!transaction) throw new NotFoundException(`Transaction ${id} not found`);
    return transaction;
  }
}
