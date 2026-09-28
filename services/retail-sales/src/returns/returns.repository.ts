import { Injectable } from "@nestjs/common";
import { Prisma } from "../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";

export interface LineReturnIncrement {
  transactionLineId: string;
  quantityReturned: number;
}

@Injectable()
export class ReturnsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Reserves the next return receipt sequence number before the row is written. */
  async nextSequence(): Promise<number> {
    const [{ nextval }] = await this.prisma.$queryRaw<{ nextval: bigint }[]>`
      SELECT nextval(pg_get_serial_sequence('"ReturnTransaction"', 'sequence')) AS nextval
    `;
    return Number(nextval);
  }

  /**
   * Writes the return and bumps each original line's quantityReturned in one
   * database transaction, so a line can never be refunded without its
   * returnable quantity going down with it.
   */
  async createWithLineIncrements(
    data: Prisma.ReturnTransactionCreateArgs["data"],
    increments: LineReturnIncrement[],
  ) {
    const [returnTransaction] = await this.prisma.$transaction([
      this.prisma.returnTransaction.create({ data, include: { lines: true } }),
      ...increments.map((increment) =>
        this.prisma.transactionLine.update({
          where: { id: increment.transactionLineId },
          data: { quantityReturned: { increment: increment.quantityReturned } },
        }),
      ),
    ]);
    return returnTransaction;
  }

  async sumRefundsForStore(storeId: string, from: Date, to: Date): Promise<number> {
    const result = await this.prisma.returnTransaction.aggregate({
      where: { storeId, createdAt: { gte: from, lt: to } },
      _sum: { refundAmount: true },
    });
    return Number(result._sum.refundAmount ?? 0);
  }
}
