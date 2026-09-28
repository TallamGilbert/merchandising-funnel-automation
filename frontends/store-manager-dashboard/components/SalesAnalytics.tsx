"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  ChartCard,
  formatCompact,
  formatDate,
  formatMoney,
  formatQuantity,
  ShareBar,
  TimeSeriesChart,
  usePolling,
} from "@mms/ui";
import { getSalesSummary, type SalesSummary } from "../lib/sales-summary";

const RANGES = [7, 14, 30] as const;
const PAYMENT_LABEL: Record<string, string> = { CASH: "Cash", CARD: "Card", GIFT_CARD: "Gift card" };

function daysBefore(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Sales trends for one store over the days leading up to `endDate`. */
export function SalesAnalytics({ storeId, endDate }: { storeId: string; endDate: string }) {
  const [days, setDays] = useState<(typeof RANGES)[number]>(14);
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const from = daysBefore(endDate, days - 1);

  const load = () => {
    setLoading(true);
    getSalesSummary(storeId, from, endDate)
      .then((result) => {
        setSummary(result);
        setError(null);
      })
      .catch((err: Error) => setError(`Sales analytics unavailable: ${err.message}`))
      .finally(() => setLoading(false));
  };
  useEffect(load, [storeId, from, endDate]);
  usePolling(load, 30000);

  const totalSales = summary?.daily.reduce((s, d) => s + d.sales, 0) ?? 0;
  const totalReturns = summary?.daily.reduce((s, d) => s + d.returns, 0) ?? 0;
  const transactions = summary?.daily.reduce((s, d) => s + d.transactions, 0) ?? 0;
  const noSales = transactions === 0;

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div className="row-between">
        <h2 style={{ margin: 0 }}>Sales analytics</h2>
        <div className="actions" role="group" aria-label="Date range">
          {RANGES.map((r) => (
            <button key={r} type="button" className={r === days ? "primary" : undefined} onClick={() => setDays(r)}>
              Last {r} days
            </button>
          ))}
        </div>
      </div>
      <p className="muted" style={{ margin: 0 }}>
        {formatDate(from)} – {formatDate(endDate)}
      </p>

      {error && <p className="error">{error}</p>}

      {summary && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", opacity: loading ? 0.6 : 1 }}>
          <div className="mms-chart-grid">
            <div className="stat-card">
              <span className="muted">Sales</span>
              <p className="stat-value">{formatMoney(totalSales)}</p>
              <p className="muted" style={{ margin: 0 }}>{formatQuantity(transactions)} transactions</p>
            </div>
            <div className="stat-card">
              <span className="muted">Refunds</span>
              <p className="stat-value">{formatMoney(totalReturns)}</p>
              <p className="muted" style={{ margin: 0 }}>
                {totalSales > 0 ? `${Math.round((totalReturns / totalSales) * 1000) / 10}% of sales` : "—"}
              </p>
            </div>
            <div className="stat-card">
              <span className="muted">Average sale</span>
              <p className="stat-value">{formatMoney(transactions ? totalSales / transactions : 0)}</p>
              <p className="muted" style={{ margin: 0 }}>per transaction</p>
            </div>
          </div>

          <ChartCard
            title="Sales and refunds by day"
            subtitle="KES, completed sales vs refunds issued"
            empty={noSales && totalReturns === 0 ? "No sales in this period yet." : false}
            table={{
              columns: ["Date", "Sales", "Refunds", "Transactions"],
              rows: summary.daily.map((d) => [
                formatDate(d.date),
                formatMoney(d.sales),
                formatMoney(d.returns),
                d.transactions,
              ]),
            }}
          >
            <TimeSeriesChart
              points={summary.daily.map((d) => ({ date: d.date, values: { sales: d.sales, returns: d.returns } }))}
              series={[
                { key: "sales", label: "Sales" },
                { key: "returns", label: "Refunds" },
              ]}
              format={(v) => formatMoney(v)}
              formatTick={(v) => formatCompact(v)}
            />
          </ChartCard>

          <div className="mms-chart-grid">
            <ChartCard
              title="How customers paid"
              subtitle="Share of takings by payment method"
              empty={noSales ? "No payments in this period." : false}
              table={{
                columns: ["Method", "Amount"],
                rows: summary.paymentMix.map((p) => [PAYMENT_LABEL[p.method] ?? p.method, formatMoney(p.amount)]),
              }}
            >
              <ShareBar
                segments={summary.paymentMix.map((p) => ({ label: PAYMENT_LABEL[p.method] ?? p.method, value: p.amount }))}
                format={(v) => formatMoney(v)}
              />
            </ChartCard>

            <ChartCard
              title="Best sellers"
              subtitle="Top 5 products by revenue"
              empty={noSales ? "Nothing sold in this period." : false}
              table={{
                columns: ["Product", "Units", "Revenue"],
                rows: summary.topProducts.map((p) => [p.productName, p.quantity, formatMoney(p.revenue)]),
              }}
            >
              <BarChart
                data={summary.topProducts.map((p) => ({
                  label: p.productName,
                  value: p.revenue,
                  detail: `${formatQuantity(p.quantity)} units · ${p.sku}`,
                }))}
                format={(v) => formatMoney(v)}
              />
            </ChartCard>
          </div>
        </div>
      )}
    </section>
  );
}
