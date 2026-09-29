"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  ChartCard,
  formatCompact,
  formatDate,
  formatMoney,
  formatQuantity,
  TimeSeriesChart,
  useLocations,
} from "@mms/ui";
import { AppShell } from "../../components/AppShell";
import { DateRange, defaultRange, type Range } from "../../components/DateRange";
import { api, type Profitability, type ProfitGrouping, type ProfitRow } from "../../lib/api";
import { NAV } from "../../lib/nav";

const GROUPINGS: { key: ProfitGrouping; label: string }[] = [
  { key: "product", label: "By product" },
  { key: "store", label: "By store" },
  { key: "day", label: "By day" },
];

const TOP = 10;

export default function ProfitabilityPage() {
  const [range, setRange] = useState<Range>(defaultRange);
  const [groupBy, setGroupBy] = useState<ProfitGrouping>("product");
  const [report, setReport] = useState<Profitability | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { data: stores } = useLocations("STORE");

  useEffect(() => {
    setLoading(true);
    api
      .profitability(range.from, range.to, groupBy)
      .then((result) => {
        setReport(result);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [range.from, range.to, groupBy]);

  const label = (row: ProfitRow) =>
    groupBy === "store"
      ? (stores.find((s) => s.code === row.key)?.name ?? row.key)
      : groupBy === "day"
        ? formatDate(row.key)
        : row.label;

  // `report` can briefly lag a grouping switch; only chart rows it was built for.
  const rows = report?.groupBy === groupBy ? report.rows : [];
  const empty = rows.length === 0 || rows.every((r) => r.revenue === 0 && r.cogs === 0);
  const margin = (r: ProfitRow) => (r.marginPct === null ? "—" : `${r.marginPct}%`);

  return (
    <AppShell
      brandName="Finance"
      nav={NAV}
      title="Profitability"
      subtitle="Revenue and gross profit by product, store and day (FR-8.5). Revenue is net of VAT; refunds net off."
    >
      <DateRange value={range} onChange={setRange} />

      <div className="actions" role="group" aria-label="Group by">
        {GROUPINGS.map((g) => (
          <button key={g.key} type="button" className={g.key === groupBy ? "primary" : undefined} onClick={() => setGroupBy(g.key)}>
            {g.label}
          </button>
        ))}
      </div>

      {error && <p className="error">{error}</p>}

      {report && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", opacity: loading ? 0.6 : 1 }}>
          <div className="mms-chart-grid">
            <div className="stat-card">
              <span className="muted">Revenue</span>
              <p className="stat-value">{formatMoney(report.total.revenue)}</p>
              <p className="muted" style={{ margin: 0 }}>{formatQuantity(report.total.quantity)} units net of returns</p>
            </div>
            <div className="stat-card">
              <span className="muted">Cost of goods sold</span>
              <p className="stat-value">{formatMoney(report.total.cogs)}</p>
              <p className="muted" style={{ margin: 0 }}>At Inventory unit cost when sold</p>
            </div>
            <div className="stat-card">
              <span className="muted">Gross profit</span>
              <p className="stat-value">{formatMoney(report.total.grossProfit)}</p>
              <p className="muted" style={{ margin: 0 }}>{margin(report.total)} margin</p>
            </div>
          </div>

          <ChartCard
            title={groupBy === "day" ? "Gross profit by day" : `Gross profit ${groupBy === "product" ? "by product" : "by store"}`}
            subtitle={groupBy === "product" && rows.length > TOP ? `Top ${TOP} of ${rows.length} products, KES` : "KES"}
            empty={empty ? "Nothing sold in this period." : false}
            table={{
              columns: [groupBy === "product" ? "Product" : groupBy === "store" ? "Store" : "Day", "Units", "Revenue", "Cost of goods", "Gross profit", "Margin"],
              rows: rows.map((r) => [label(r), formatQuantity(r.quantity), formatMoney(r.revenue), formatMoney(r.cogs), formatMoney(r.grossProfit), margin(r)]),
            }}
          >
            {groupBy === "day" ? (
              <TimeSeriesChart
                points={rows.map((r) => ({ date: r.key, values: { revenue: r.revenue, grossProfit: r.grossProfit } }))}
                series={[
                  { key: "revenue", label: "Revenue" },
                  { key: "grossProfit", label: "Gross profit" },
                ]}
                format={(v) => formatMoney(v)}
                formatTick={(v) => formatCompact(v)}
              />
            ) : (
              <BarChart
                data={rows
                  .filter((r) => r.grossProfit > 0)
                  .slice(0, TOP)
                  .map((r) => ({
                    label: label(r),
                    value: r.grossProfit,
                    detail: `${formatMoney(r.revenue)} revenue · ${margin(r)} margin`,
                  }))}
                format={(v) => formatMoney(v)}
              />
            )}
          </ChartCard>

          <div className="card" style={{ padding: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>{groupBy === "product" ? "Product" : groupBy === "store" ? "Store" : "Day"}</th>
                  <th className="num">Units</th>
                  <th className="num">Revenue</th>
                  <th className="num">Cost of goods</th>
                  <th className="num">Gross profit</th>
                  <th className="num">Margin</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key}>
                    <td>
                      {label(r)}
                      {groupBy === "product" && <div className="muted" style={{ fontSize: "0.78rem" }}>{r.key}</div>}
                    </td>
                    <td className="num">{formatQuantity(r.quantity)}</td>
                    <td className="num">{formatMoney(r.revenue)}</td>
                    <td className="num">{formatMoney(r.cogs)}</td>
                    <td className="num">{formatMoney(r.grossProfit)}</td>
                    <td className="num">{margin(r)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th>Whole business</th>
                  <th className="num">{formatQuantity(report.total.quantity)}</th>
                  <th className="num">{formatMoney(report.total.revenue)}</th>
                  <th className="num">{formatMoney(report.total.cogs)}</th>
                  <th className="num">{formatMoney(report.total.grossProfit)}</th>
                  <th className="num">{margin(report.total)}</th>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </AppShell>
  );
}
