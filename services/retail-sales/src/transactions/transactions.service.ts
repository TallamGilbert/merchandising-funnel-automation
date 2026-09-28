import { Injectable, NotFoundException } from "@nestjs/common";
import { TransactionsRepository } from "./transactions.repository";

@Injectable()
export class TransactionsService {
  constructor(private readonly transactions: TransactionsRepository) {}

  async findOne(id: string) {
    const transaction = await this.transactions.findByIdWithDetails(id);
    if (!transaction) throw new NotFoundException(`Transaction ${id} not found`);
    return transaction;
  }
}
