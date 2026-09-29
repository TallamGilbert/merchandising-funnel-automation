import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ACCOUNTS } from "../accounts/chart-of-accounts";
import { BillStatus, EntrySource, PayableBill } from "../generated/prisma";
import { balanced } from "../ledger/journal";
import { parseDay } from "../ledger/ledger.service";
import { fromCents, toCents } from "../ledger/money";
import { PayablesRepository } from "./payables.repository";

const DAY_MS = 24 * 60 * 60 * 1000;

export const AGING_BUCKETS = ["current", "1-30", "31-60", "61-90", "90+"] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number];

function utcDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** Calendar days a bill is past its due date on `asOf` (0 or less = not yet due). */
export function daysOverdue(dueDate: Date, asOf: Date): number {
  return Math.round((utcDay(asOf) - utcDay(dueDate)) / DAY_MS);
}

export function agingBucket(days: number): AgingBucket {
  if (days <= 0) return "current";
  if (days <= 30) return "1-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

@Injectable()
export class PayablesService {
  constructor(private readonly payables: PayablesRepository) {}

  /** FR-8.4 — what's owed to whom, and when it's due. */
  async list(filter: { status?: BillStatus; supplierId?: string }) {
    const now = new Date();
    const bills = await this.payables.findAll(filter);
    return bills.map((bill) => this.withAge(bill, now));
  }

  /** FR-8.6 — AP aging: open balances per supplier by how overdue they are. */
  async aging(asOfDay?: string) {
    const asOf = parseDay(asOfDay, "asOf") ?? new Date();
    const open = await this.payables.findAll({ status: BillStatus.OPEN });

    const suppliers = new Map<string, { supplierId: string; supplierName: string; buckets: Record<AgingBucket, number>; total: number }>();
    const totals = Object.fromEntries(AGING_BUCKETS.map((b) => [b, 0])) as Record<AgingBucket, number>;

    for (const bill of open) {
      const bucket = agingBucket(daysOverdue(bill.dueDate, asOf));
      const cents = toCents(bill.amount);
      const row =
        suppliers.get(bill.supplierId) ??
        {
          supplierId: bill.supplierId,
          supplierName: bill.supplierName,
          buckets: Object.fromEntries(AGING_BUCKETS.map((b) => [b, 0])) as Record<AgingBucket, number>,
          total: 0,
        };
      row.buckets[bucket] += cents;
      row.total += cents;
      totals[bucket] += cents;
      suppliers.set(bill.supplierId, row);
    }

    const toMoney = (b: Record<AgingBucket, number>) =>
      Object.fromEntries(AGING_BUCKETS.map((k) => [k, fromCents(b[k])])) as Record<AgingBucket, number>;
    return {
      asOf: asOf.toISOString(),
      buckets: AGING_BUCKETS,
      suppliers: [...suppliers.values()]
        .map((s) => ({ ...s, buckets: toMoney(s.buckets), total: fromCents(s.total) }))
        .sort((a, b) => b.total - a.total),
      totals: toMoney(totals),
      totalOutstanding: fromCents(Object.values(totals).reduce((a, b) => a + b, 0)),
    };
  }

  /** Paying a bill: Dr Accounts payable, Cr Bank. */
  async pay(id: string, paymentReference?: string, paidOn?: string) {
    const bill = await this.payables.findById(id);
    if (!bill) throw new NotFoundException(`Bill ${id} not found`);
    if (bill.status === BillStatus.PAID) throw new BadRequestException(`${bill.goodsReceivedNoteNumber} is already paid`);

    const paidAt = parseDay(paidOn, "paidOn") ?? new Date();
    const amount = Number(bill.amount);
    const entry = balanced({
      occurredAt: paidAt,
      source: EntrySource.BILL_PAYMENT,
      sourceRef: bill.id,
      description: `Paid ${bill.supplierName} for ${bill.goodsReceivedNoteNumber} (${bill.poNumber})${paymentReference ? ` — ref ${paymentReference}` : ""}`,
      lines: [
        { accountCode: ACCOUNTS.ACCOUNTS_PAYABLE.code, debit: amount, memo: bill.supplierName },
        { accountCode: ACCOUNTS.BANK.code, credit: amount, memo: paymentReference },
      ],
    });

    if (!(await this.payables.pay(id, paidAt, paymentReference, entry))) {
      throw new BadRequestException(`${bill.goodsReceivedNoteNumber} is already paid`);
    }
    return this.withAge({ ...bill, status: BillStatus.PAID, paidAt, paymentReference: paymentReference ?? null }, new Date());
  }

  private withAge(bill: PayableBill, now: Date) {
    const overdue = bill.status === BillStatus.OPEN ? daysOverdue(bill.dueDate, now) : 0;
    return { ...bill, daysOverdue: Math.max(overdue, 0), agingBucket: bill.status === BillStatus.OPEN ? agingBucket(overdue) : null };
  }
}
