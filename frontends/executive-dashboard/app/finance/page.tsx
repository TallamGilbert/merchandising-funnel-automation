"use client";

import { useState } from "react";
import { BarChart, ChartCard, formatCompact, formatDate, formatMoney, formatSignedMoney, TimeSeriesChart } from "@mms/ui";
import { AppShell } from "../../components/AppShell";
import { DateRange, defaultRange, type Range } from "../../components/DateRange";
import { Kpi, OpenApp, Show } from "../../components/Panels";
import { NAV, STATUS_CARD } from "../../lib/nav";
import { APP_URL, services } from "../../lib/services";
import { useLive } from "../../lib/useLive";

const BUCKET_LABEL: Record<string, string> = {
  current: "Not yet due",
  "1-30": "1–30 days overdue",
  "31-60": "31–60 days overdue",
  "61-90": "61–90 days overdue",
  "90+": "Over 90 days overdue",
};

export default function FinancePage() {
  const [range, setRange] = useState<Range>(defaultRange);
  const summary = useLive(() => services.financeSummary(range.from, range.to), [range.from, range.to]);
  const aging = useLive(() => services.aging(), []);

  return (
    <AppShell
      brandName="Executive"
      nav={NAV}
      statusCard={STATUS_CARD}
      title="Finance"
      subtitle="Is the business making money, and what does it owe? Revenue is net of VAT and refunds."
      actions={<OpenApp href={APP_URL.finance} label="Finance Portal" />}
    >
      <DateRange value={range} onChange={setRange} />

      <Show live={summary} what="Financials">
        {(f) => (
          <>
            {f.inbox.needsAttention > 0 && (
              <div className="card" style={{ borderColor: "var(--danger)", background: "var(--danger-soft)" }}>
                <strong>{f.inbox.needsAttention} accounting event(s) couldn&apos;t be booked</strong>
                <span className="muted">
                  These figures are missing them until the finance team resolves them in the{" "}
                  <a href={`${APP_URL.finance}/events`} target="_blank" rel="noreferrer">Finance Portal</a>.
                </span>
              </div>
            )}
            <div className="mms-chart-grid">
              <Kpi label="Revenue" value={formatMoney(f.revenue)} note={`${formatDate(range.from)} – ${formatDate(range.to)}`} />
              <Kpi label="Gross profit" value={formatMoney(f.grossProfit)} note={f.marginPct === null ? "No sales booked" : `${f.marginPct}% margin`} />
              <Kpi label="Cost of goods sold" value={formatMoney(f.cogs)} />
              <Kpi
                label="Cash over/short"
                value={f.cashOverShort === 0 ? formatMoney(0) : formatSignedMoney(-f.cashOverShort)}
                note={f.cashOverShort > 0 ? "Net shortage at store closes" : f.cashOverShort < 0 ? "Net overage" : "Every till balanced"}
                tone={f.cashOverShort > 0 ? "warn" : undefined}
              />
            </div>
            <ChartCard
              title="Revenue and gross profit by day"
              empty={f.daily.every((d) => d.revenue === 0 && d.cogs === 0) ? "No sales booked in this period." : false}
              table={{
                columns: ["Date", "Revenue", "Cost of goods", "Gross profit"],
                rows: f.daily.map((d) => [formatDate(d.date), formatMoney(d.revenue), formatMoney(d.cogs), formatMoney(d.grossProfit)]),
              }}
            >
              <TimeSeriesChart
                points={f.daily.map((d) => ({ date: d.date, values: { revenue: d.revenue, grossProfit: d.grossProfit } }))}
                series={[
                  { key: "revenue", label: "Revenue" },
                  { key: "grossProfit", label: "Gross profit" },
                ]}
                format={(v) => formatMoney(v)}
                formatTick={(v) => formatCompact(v)}
              />
            </ChartCard>
          </>
        )}
      </Show>

      <Show live={aging} what="Accounts payable">
        {(a) => (
          <div className="mms-chart-grid">
            <Kpi
              label="Owed to suppliers"
              value={formatMoney(a.totalOutstanding)}
              note={`${formatMoney(a.totalOutstanding - (a.totals.current ?? 0))} overdue`}
              tone={a.totalOutstanding - (a.totals.current ?? 0) > 0 ? "danger" : undefined}
            />
            <ChartCard
              title="How overdue"
              empty={a.totalOutstanding === 0 ? "Nothing owed right now." : false}
              table={{ columns: ["Age", "Owed"], rows: a.buckets.map((b) => [BUCKET_LABEL[b], formatMoney(a.totals[b] ?? 0)]) }}
            >
              <BarChart data={a.buckets.map((b) => ({ label: BUCKET_LABEL[b], value: a.totals[b] ?? 0 }))} format={(v) => formatMoney(v)} />
            </ChartCard>
            <ChartCard
              title="Largest balances"
              empty={a.suppliers.length === 0 ? "Nothing owed right now." : false}
              table={{ columns: ["Supplier", "Owed"], rows: a.suppliers.map((s) => [s.supplierName, formatMoney(s.total)]) }}
            >
              <BarChart data={a.suppliers.slice(0, 6).map((s) => ({ label: s.supplierName, value: s.total }))} format={(v) => formatMoney(v)} />
            </ChartCard>
          </div>
        )}
      </Show>
    </AppShell>
  );
}
