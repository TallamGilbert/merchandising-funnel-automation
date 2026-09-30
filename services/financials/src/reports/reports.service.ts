import { BadRequestException, Injectable } from "@nestjs/common";
import { BillStatus, InboxStatus } from "../generated/prisma";
import { InboxRepository } from "../inbox/inbox.repository";
import { LedgerRepository } from "../ledger/ledger.repository";
import { parseDay } from "../ledger/ledger.service";
import { fromCents, toCents } from "../ledger/money";
import { PayablesRepository } from "../payables/payables.repository";
import { daysOverdue } from "../payables/payables.service";

export type ProfitGrouping = "product" | "store" | "day";

export interface ProfitRow {
  key: string;
  label: string;
  quantity: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  /** Gross profit as a % of revenue; null when there's no revenue. */
  marginPct: number | null;
}

interface FactLike {
  businessDate: string;
  storeId: string;
  sku: string;
  productName: string;
  quantity: number;
  revenue: { toString(): string } | number;
  cogs: { toString(): string } | number;
}

const MAX_DAYS = 366;

function range(from: string, to: string): { start: Date; end: Date; days: string[] } {
  const start = parseDay(from, "from");
  const end = parseDay(to, "to", true);
  if (!start || !end || start >= end) throw new BadRequestException("from must be on or before to");
  const days: string[] = [];
  for (const d = new Date(start); d < end; d.setUTCDate(d.getUTCDate() + 1)) {
    days.push(d.toISOString().slice(0, 10));
    if (days.length > MAX_DAYS) throw new BadRequestException(`A report can cover at most ${MAX_DAYS} days`);
  }
  return { start, end, days };
}

function row(key: string, label: string, quantity: number, revenueCents: number, cogsCents: number): ProfitRow {
  const gp = revenueCents - cogsCents;
  return {
    key,
    label,
    quantity,
    revenue: fromCents(revenueCents),
    cogs: fromCents(cogsCents),
    grossProfit: fromCents(gp),
    marginPct: revenueCents === 0 ? null : Math.round((gp / revenueCents) * 1000) / 10,
  };
}

/** FR-8.5 — revenue and gross profit rolled up by product, store or day (returns net off). */
export function rollUp(facts: FactLike[], groupBy: ProfitGrouping): ProfitRow[] {
  const groups = new Map<string, { label: string; quantity: number; revenue: number; cogs: number }>();
  for (const f of facts) {
    const key = groupBy === "product" ? f.sku : groupBy === "store" ? f.storeId : f.businessDate;
    const label = groupBy === "product" ? f.productName : key;
    const g = groups.get(key) ?? { label, quantity: 0, revenue: 0, cogs: 0 };
    g.quantity += f.quantity;
    g.revenue += toCents(f.revenue);
    g.cogs += toCents(f.cogs);
    groups.set(key, g);
  }
  return [...groups.entries()].map(([key, g]) => row(key, g.label, g.quantity, g.revenue, g.cogs));
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly ledger: LedgerRepository,
    private readonly payables: PayablesRepository,
    private readonly inboxRepository: InboxRepository,
  ) {}

  /** FR-8.5/8.6 — profitability by product, store or day, plus the business total. */
  async profitability(from: string, to: string, groupBy: ProfitGrouping) {
    const { start, end, days } = range(from, to);
    const facts = await this.ledger.findSaleFactsBetween(start, end);
    let rows = rollUp(facts, groupBy);
    if (groupBy === "day") {
      const byDay = new Map(rows.map((r) => [r.key, r]));
      rows = days.map((d) => byDay.get(d) ?? row(d, d, 0, 0, 0));
    } else {
      rows.sort((a, b) => b.grossProfit - a.grossProfit);
    }
    const total = rollUp(facts.map((f) => ({ ...f, storeId: "all" })), "store")[0] ?? row("all", "all", 0, 0, 0);
    return { from, to, groupBy, rows, total: { ...total, key: "business", label: "Whole business" } };
  }

  /** The Finance Portal's front page in one call. */
  async summary(from: string, to: string) {
    const { start, end } = range(from, to);
    const [profit, overShort, openBills, inboxCounts] = await Promise.all([
      this.profitability(from, to, "day"),
      this.ledger.cashOverShort(start, end),
      this.payables.findAll({ status: BillStatus.OPEN }),
      this.inboxRepository.countByStatus(),
    ]);

    const now = new Date();
    const overdue = openBills.filter((b) => daysOverdue(b.dueDate, now) > 0);
    const count = (status: InboxStatus) => inboxCounts.find((c) => c.status === status)?._count._all ?? 0;

    return {
      from,
      to,
      revenue: profit.total.revenue,
      cogs: profit.total.cogs,
      grossProfit: profit.total.grossProfit,
      marginPct: profit.total.marginPct,
      cashOverShort: Number(overShort),
      payables: {
        outstanding: fromCents(openBills.reduce((s, b) => s + toCents(b.amount), 0)),
        openBills: openBills.length,
        overdue: fromCents(overdue.reduce((s, b) => s + toCents(b.amount), 0)),
        overdueBills: overdue.length,
      },
      inbox: { pending: count(InboxStatus.PENDING), needsAttention: count(InboxStatus.NEEDS_ATTENTION) },
      daily: profit.rows.map((r) => ({ date: r.key, revenue: r.revenue, cogs: r.cogs, grossProfit: r.grossProfit })),
    };
  }
}
