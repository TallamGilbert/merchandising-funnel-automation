import { Injectable } from "@nestjs/common";
import { EntrySource, InboxStatus, Prisma } from "../generated/prisma";
import { ACCOUNTS } from "../accounts/chart-of-accounts";
import { PrismaService } from "../prisma/prisma.service";
import { PostingPlan } from "../postings/posting-plan";

export interface EntryFilter {
  from?: Date;
  to?: Date;
  accountCode?: string;
  source?: EntrySource;
  take: number;
}

@Injectable()
export class LedgerRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** The original sale's facts, so a return reverses at the sale's tax split and cost. */
  findSaleFacts(transactionId: string) {
    return this.prisma.saleLineFact.findMany({ where: { transactionId, returnId: null } });
  }

  /**
   * Commits one event's posting atomically: journal entry + lines, the
   * supplier bill, sale facts, and marks the inbox event POSTED. If an
   * entry for the same source document already exists (a redelivered event
   * under a new id), nothing is booked twice.
   */
  async commit(plan: PostingPlan, inboxEventId?: string): Promise<{ entryId: string | null; duplicate: boolean }> {
    return this.prisma.$transaction(async (tx) => {
      let entryId: string | null = null;
      let duplicate = false;

      if (plan.entry) {
        const existing = await tx.journalEntry.findFirst({
          where: { source: plan.entry.source, sourceRef: plan.entry.sourceRef },
          select: { id: true },
        });
        if (existing) {
          duplicate = true;
          entryId = existing.id;
        } else {
          const created = await tx.journalEntry.create({
            data: {
              occurredAt: plan.entry.occurredAt,
              source: plan.entry.source,
              sourceRef: plan.entry.sourceRef,
              description: plan.entry.description,
              storeId: plan.entry.storeId,
              lines: {
                create: plan.entry.lines.map((l) => ({
                  accountCode: l.accountCode,
                  debit: l.debit ?? 0,
                  credit: l.credit ?? 0,
                  memo: l.memo,
                })),
              },
            },
          });
          entryId = created.id;
        }
      }

      if (!duplicate) {
        if (plan.bill) await tx.payableBill.create({ data: plan.bill });
        if (plan.facts?.length) await tx.saleLineFact.createMany({ data: plan.facts });
      }

      if (inboxEventId) {
        await tx.inboxEvent.update({
          where: { eventId: inboxEventId },
          data: { status: InboxStatus.POSTED, postedAt: new Date(), lastError: null },
        });
      }
      return { entryId, duplicate };
    });
  }

  findEntries(filter: EntryFilter) {
    return this.prisma.journalEntry.findMany({
      where: {
        occurredAt: { gte: filter.from, lt: filter.to },
        source: filter.source,
        lines: filter.accountCode ? { some: { accountCode: filter.accountCode } } : undefined,
      },
      include: { lines: { orderBy: [{ debit: "desc" }, { accountCode: "asc" }] } },
      orderBy: { sequence: "desc" },
      take: filter.take,
    });
  }

  /** Debit and credit totals per account for everything up to `asOf`. */
  totalsByAccount(asOf?: Date) {
    return this.prisma.journalLine.groupBy({
      by: ["accountCode"],
      where: asOf ? { entry: { occurredAt: { lt: asOf } } } : undefined,
      _sum: { debit: true, credit: true },
    });
  }

  findSaleFactsBetween(from: Date, to: Date) {
    return this.prisma.saleLineFact.findMany({ where: { occurredAt: { gte: from, lt: to } } });
  }

  /** Net cash over/short booked by day closes in the range (positive = shortage expense). */
  async cashOverShort(from: Date, to: Date): Promise<Prisma.Decimal> {
    const result = await this.prisma.journalLine.aggregate({
      where: { accountCode: ACCOUNTS.CASH_OVER_SHORT.code, entry: { occurredAt: { gte: from, lt: to } } },
      _sum: { debit: true, credit: true },
    });
    const debit = result._sum.debit ?? new Prisma.Decimal(0);
    const credit = result._sum.credit ?? new Prisma.Decimal(0);
    return debit.minus(credit);
  }
}
