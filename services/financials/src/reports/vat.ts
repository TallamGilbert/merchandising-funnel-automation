import { EntrySource } from "../generated/prisma";
import { fromCents, toCents } from "../ledger/money";

/**
 * D-20 — the VAT-payable account (2100) by month: VAT charged on sales,
 * VAT given back on refunds, anything else (corrections), and the net owed.
 * Output VAT only: supplier bills don't carry input VAT in this system.
 */
export interface VatLine {
  debit: { toString(): string } | number;
  credit: { toString(): string } | number;
  occurredAt: Date;
  source: EntrySource;
}

export interface VatMonth {
  /** YYYY-MM (UTC). */
  month: string;
  outputVat: number;
  refundedVat: number;
  otherAdjustments: number;
  /** outputVat − refundedVat + otherAdjustments: what the period adds to VAT owed. */
  netVat: number;
}

export function vatByMonth(lines: VatLine[]): { months: VatMonth[]; total: Omit<VatMonth, "month"> } {
  const months = new Map<string, { output: number; refunded: number; other: number }>();
  for (const line of lines) {
    const month = line.occurredAt.toISOString().slice(0, 7);
    const m = months.get(month) ?? { output: 0, refunded: 0, other: 0 };
    const credit = toCents(line.credit);
    const debit = toCents(line.debit);
    if (line.source === EntrySource.ITEM_SOLD) m.output += credit - debit;
    else if (line.source === EntrySource.ITEM_RETURNED) m.refunded += debit - credit;
    else m.other += credit - debit;
    months.set(month, m);
  }
  const rows = [...months.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, m]) => ({
      month,
      outputVat: fromCents(m.output),
      refundedVat: fromCents(m.refunded),
      otherAdjustments: fromCents(m.other),
      netVat: fromCents(m.output - m.refunded + m.other),
    }));
  const sum = (key: keyof Omit<VatMonth, "month">) => fromCents(rows.reduce((s, r) => s + toCents(r[key]), 0));
  return {
    months: rows,
    total: { outputVat: sum("outputVat"), refundedVat: sum("refundedVat"), otherAdjustments: sum("otherAdjustments"), netVat: sum("netVat") },
  };
}
