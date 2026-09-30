import { Injectable } from "@nestjs/common";
import { BillStatus } from "../generated/prisma";
import { JournalDraft } from "../ledger/journal";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class PayablesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(filter: { status?: BillStatus; supplierId?: string }) {
    return this.prisma.payableBill.findMany({
      where: { status: filter.status, supplierId: filter.supplierId },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    });
  }

  findById(id: string) {
    return this.prisma.payableBill.findUnique({ where: { id } });
  }

  /**
   * Marks the bill paid and books the payment in one transaction. The
   * status guard means two clicks on "Pay" can't pay a bill twice.
   */
  async pay(id: string, paidAt: Date, paymentReference: string | undefined, entry: JournalDraft): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.payableBill.updateMany({
        where: { id, status: BillStatus.OPEN },
        data: { status: BillStatus.PAID, paidAt, paymentReference },
      });
      if (count === 0) return false;
      await tx.journalEntry.create({
        data: {
          occurredAt: entry.occurredAt,
          source: entry.source,
          sourceRef: entry.sourceRef,
          description: entry.description,
          lines: {
            create: entry.lines.map((l) => ({ accountCode: l.accountCode, debit: l.debit ?? 0, credit: l.credit ?? 0, memo: l.memo })),
          },
        },
      });
      return true;
    });
  }
}
