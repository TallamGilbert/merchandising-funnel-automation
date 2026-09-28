import { Injectable } from "@nestjs/common";
import { Prisma, TransactionStatus } from "../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class TransactionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByIdWithDetails(id: string) {
    return this.prisma.transaction.findUnique({
      where: { id },
      include: { lines: true, payments: true, returns: { include: { lines: true } } },
    });
  }

  findByIdWithLines(id: string) {
    return this.prisma.transaction.findUnique({
      where: { id },
      include: { lines: true },
    });
  }

  findLines(transactionId: string) {
    return this.prisma.transactionLine.findMany({ where: { transactionId } });
  }

  /** Reserves the next receipt sequence number before the row is written. */
  async nextSequence(): Promise<number> {
    const [{ nextval }] = await this.prisma.$queryRaw<{ nextval: bigint }[]>`
      SELECT nextval(pg_get_serial_sequence('"Transaction"', 'sequence')) AS nextval
    `;
    return Number(nextval);
  }

  create(data: Prisma.TransactionCreateArgs["data"]) {
    return this.prisma.transaction.create({
      data,
      include: { lines: true, payments: true },
    });
  }

  updateStatus(id: string, status: TransactionStatus) {
    return this.prisma.transaction.update({ where: { id }, data: { status } });
  }

  async sumTotalForStore(storeId: string, from: Date, to: Date): Promise<number> {
    const result = await this.prisma.transaction.aggregate({
      where: { storeId, createdAt: { gte: from, lt: to } },
      _sum: { totalAmount: true },
    });
    return Number(result._sum.totalAmount ?? 0);
  }
}
