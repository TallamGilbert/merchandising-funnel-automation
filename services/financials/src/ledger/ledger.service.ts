import { BadRequestException, Injectable } from "@nestjs/common";
import { ACCOUNTS, isDebitNormal } from "../accounts/chart-of-accounts";
import { EntrySource } from "../generated/prisma";
import { LedgerRepository } from "./ledger.repository";
import { fromCents, toCents } from "./money";

export interface TrialBalanceRow {
  code: string;
  name: string;
  type: string;
  debit: number;
  credit: number;
  /** In the account's normal direction: positive = what an asset holds, a liability owes, revenue earned… */
  balance: number;
}

/** "2026-09-25" → the start of that UTC day; the day after for an inclusive end. */
export function parseDay(value: string | undefined, name: string, endOfDay = false): Date | undefined {
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new BadRequestException(`${name} must be a date (YYYY-MM-DD)`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (endOfDay) date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

@Injectable()
export class LedgerService {
  constructor(private readonly ledger: LedgerRepository) {}

  /** FR-8.6 — the general ledger, newest first. */
  entries(filter: { from?: string; to?: string; accountCode?: string; source?: EntrySource; limit?: number }) {
    return this.ledger.findEntries({
      from: parseDay(filter.from, "from"),
      to: parseDay(filter.to, "to", true),
      accountCode: filter.accountCode,
      source: filter.source,
      take: Math.min(Math.max(filter.limit ?? 100, 1), 500),
    });
  }

  /** FR-8.6 — every account's balance as of a date; debits and credits must agree. */
  async trialBalance(asOf?: string) {
    const totals = await this.ledger.totalsByAccount(parseDay(asOf, "asOf", true));
    const byCode = new Map(totals.map((t) => [t.accountCode, t._sum]));

    const rows: TrialBalanceRow[] = Object.values(ACCOUNTS).map((account) => {
      const sums = byCode.get(account.code);
      const debit = toCents(sums?.debit ?? 0);
      const credit = toCents(sums?.credit ?? 0);
      return {
        code: account.code,
        name: account.name,
        type: account.type,
        debit: fromCents(debit),
        credit: fromCents(credit),
        balance: fromCents(isDebitNormal(account.type) ? debit - credit : credit - debit),
      };
    });

    const totalDebit = fromCents(rows.reduce((s, r) => s + toCents(r.debit), 0));
    const totalCredit = fromCents(rows.reduce((s, r) => s + toCents(r.credit), 0));
    return { asOf: asOf ?? null, rows, totalDebit, totalCredit, balanced: totalDebit === totalCredit };
  }
}
