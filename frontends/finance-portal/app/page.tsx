"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ChartCard,
  formatCompact,
  formatDate,
  formatMoney,
  formatSignedMoney,
  TimeSeriesChart,
  usePolling,
} from "@mms/ui";
import { AppShell } from "../components/AppShell";
import { DateRange, defaultRange, type Range } from "../components/DateRange";
import { api, type Summary } from "../lib/financials-client";
import { NAV, STATUS_CARD } from "../lib/nav";

const FEATURE_ENABLED = process.env.NEXT_PUBLIC_FEATURE_FINANCIALS_ENABLED !== "false";

export default function Page() {
  const [range, setRange] = useState<Range>(defaultRange);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = () => {
    if (!FEATURE_ENABLED) return;
    setLoading(true);
    api
      .summary(range.from, range.to)
      .then((result) => {
        setSummary(result);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, [range.from, range.to]);
  // Sales post within seconds of checkout — keep the numbers current.
  usePolling(load, 30000, FEATURE_ENABLED);

  if (!FEATURE_ENABLED) {
    return (
      <main className="page-body">
        <h1>Finance Portal</h1>
        <p>
          <strong>Phase 4 — Accounting</strong> — this module is implemented, but its feature flag is currently off.
        </p>
        <p>
          Set <code>NEXT_PUBLIC_FEATURE_FINANCIALS_ENABLED=true</code> to view it.
        </p>
      </main>
    );
  }

  const noSales = summary?.daily.every((d) => d.revenue === 0 && d.cogs === 0) ?? true;

  return (
    <AppShell
      brandName="Finance"
      nav={NAV}
      statusCard={STATUS_CARD}
      title="Overview"
      subtitle="What the business owns, what it owes, and whether it's making money."
    >
      <DateRange value={range} onChange={setRange} />
      <p className="muted" style={{ margin: 0 }}>
        {formatDate(range.from)} – {formatDate(range.to)}
      </p>

      {error && <p className="error">{error}</p>}

      {summary && summary.inbox.needsAttention > 0 && (
        <div className="card" style={{ borderColor: "var(--danger)", background: "var(--danger-soft)" }}>
          <strong>
            {summary.inbox.needsAttention} event{summary.inbox.needsAttention === 1 ? "" : "s"} couldn&apos;t be
            posted to the ledger
          </strong>
          <span className="muted">
            The books are missing these until someone resolves them. <Link href="/events">Review posting issues</Link>
          </span>
        </div>
      )}

      {summary && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", opacity: loading ? 0.6 : 1 }}>
          <div className="mms-chart-grid">
            <div className="stat-card">
              <span className="muted">Revenue</span>
              <p className="stat-value">{formatMoney(summary.revenue)}</p>
              <p className="muted" style={{ margin: 0 }}>Net of VAT and refunds</p>
            </div>
            <div className="stat-card">
              <span className="muted">Gross profit</span>
              <p className="stat-value">{formatMoney(summary.grossProfit)}</p>
              <p className="muted" style={{ margin: 0 }}>
                {summary.marginPct === null ? "No sales yet" : `${summary.marginPct}% margin`} · cost of goods{" "}
                {formatMoney(summary.cogs)}
              </p>
            </div>
            <div className="stat-card">
              <span className="muted">Owed to suppliers</span>
              <p className="stat-value">{formatMoney(summary.payables.outstanding)}</p>
              <p className="muted" style={{ margin: 0 }}>
                {summary.payables.overdueBills > 0 ? (
                  <Link href="/payables">
                    {formatMoney(summary.payables.overdue)} overdue on {summary.payables.overdueBills} bill
                    {summary.payables.overdueBills === 1 ? "" : "s"}
                  </Link>
                ) : (
                  `${summary.payables.openBills} open bill${summary.payables.openBills === 1 ? "" : "s"}, none overdue`
                )}
              </p>
            </div>
            <div className="stat-card">
              <span className="muted">Cash over/short</span>
              <p className="stat-value">
                {summary.cashOverShort === 0 ? formatMoney(0) : formatSignedMoney(-summary.cashOverShort)}
              </p>
              <p className="muted" style={{ margin: 0 }}>
                {summary.cashOverShort > 0 ? "Net shortage at store closes" : summary.cashOverShort < 0 ? "Net overage at store closes" : "Every till balanced"}
              </p>
            </div>
          </div>

          <ChartCard
            title="Revenue and gross profit by day"
            subtitle="KES, net of VAT; refunds reduce the day they're given"
            empty={noSales ? "No sales posted in this period yet." : false}
            table={{
              columns: ["Date", "Revenue", "Cost of goods", "Gross profit"],
              rows: summary.daily.map((d) => [formatDate(d.date), formatMoney(d.revenue), formatMoney(d.cogs), formatMoney(d.grossProfit)]),
            }}
          >
            <TimeSeriesChart
              points={summary.daily.map((d) => ({ date: d.date, values: { revenue: d.revenue, grossProfit: d.grossProfit } }))}
              series={[
                { key: "revenue", label: "Revenue" },
                { key: "grossProfit", label: "Gross profit" },
              ]}
              format={(v) => formatMoney(v)}
              formatTick={(v) => formatCompact(v)}
            />
          </ChartCard>
        </div>
      )}
    </AppShell>
  );
}
