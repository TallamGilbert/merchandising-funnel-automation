"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  ChartCard,
  DateRange,
  defaultRange,
  downloadCsv,
  ExportMenu,
  formatMoney,
  LocationPicker,
  lookupApi,
  type Range,
  useCurrentUser,
  useLocations,
  useStaffNames,
  withQuery,
} from "@mms/ui";
import { AppShell } from "../../components/AppShell";
import { NAV } from "../../lib/nav";
import { getSalesReport, rollUp, type SalesGrouping, salesReportUrl, type SalesReportRow } from "../../lib/sales-report";

type Tab = "cashier" | "hour" | "category" | "sku";

const TABS: { key: Tab; label: string }[] = [
  { key: "cashier", label: "By cashier" },
  { key: "hour", label: "By hour" },
  { key: "category", label: "By category" },
  { key: "sku", label: "By product" },
];

const UNCATEGORISED = "Uncategorised";

function hourLabel(key: string): string {
  const h = Number(key);
  return `${String(h).padStart(2, "0")}:00–${String((h + 1) % 24).padStart(2, "0")}:00`;
}

/** D-20 — who sells, when, and what: the reports a store manager asks for. */
export default function ReportsPage() {
  const user = useCurrentUser();
  const nameOf = useStaffNames();
  const { data: stores } = useLocations("STORE");
  const [range, setRange] = useState<Range>(defaultRange);
  const [storeId, setStoreId] = useState("");
  const [tab, setTab] = useState<Tab>("cashier");
  const [rows, setRows] = useState<SalesReportRow[] | null>(null);
  const [categories, setCategories] = useState<Map<string, string> | null>(null);
  const [error, setError] = useState<string | null>(null);

  // A manager starts on their own store; an owner on every store.
  useEffect(() => {
    if (user.locationCode && stores.some((s) => s.code === user.locationCode)) setStoreId(user.locationCode);
  }, [user.locationCode, stores]);

  const groupBy: SalesGrouping = tab === "category" ? "sku" : tab;
  const params = { from: range.from, to: range.to, storeId: storeId || undefined, groupBy };

  useEffect(() => {
    setRows(null);
    setError(null);
    getSalesReport(params)
      .then(setRows)
      .catch((err: Error) => setError(err.message));
    // params is rebuilt every render; these are its parts.
  }, [range.from, range.to, storeId, groupBy]);

  useEffect(() => {
    if (tab !== "category" || categories) return;
    lookupApi
      .listCatalogProducts()
      .then((products) => setCategories(new Map(products.map((p) => [p.sku, p.category ?? UNCATEGORISED]))))
      .catch((err: Error) => setError(`Couldn't load product categories: ${err.message}`));
  }, [tab, categories]);

  const shown = useMemo(() => {
    if (!rows) return null;
    if (tab === "category") {
      return categories ? rollUp(rows, (r) => categories.get(r.key) ?? UNCATEGORISED) : null;
    }
    return rows.map((r) => ({
      ...r,
      label: tab === "cashier" ? nameOf(r.key) : tab === "hour" ? hourLabel(r.key) : `${r.label} (${r.key})`,
    }));
  }, [rows, tab, categories, nameOf]);

  const totals = useMemo(() => {
    const all = shown ?? [];
    const sum = (k: keyof SalesReportRow) => Math.round(all.reduce((s, r) => s + Number(r[k]), 0) * 100) / 100;
    return { units: sum("units"), sales: sum("sales"), discounts: sum("discounts"), returns: sum("returns"), net: sum("net") };
  }, [shown]);

  const storeName = storeId ? (stores.find((s) => s.code === storeId)?.name ?? storeId) : "All stores";
  const exportCategory = () =>
    downloadCsv(
      "sales-by-category",
      [
        { header: "Category", value: (r: SalesReportRow) => r.key },
        { header: "Units sold", value: (r) => r.units },
        { header: "Sales (KES)", value: (r) => r.sales },
        { header: "Discounts (KES)", value: (r) => r.discounts },
        { header: "VAT (KES)", value: (r) => r.vat },
        { header: "Returns (KES)", value: (r) => r.returns },
        { header: "Units returned", value: (r) => r.unitsReturned },
        { header: "Net (KES)", value: (r) => r.net },
      ],
      shown ?? [],
    );

  return (
    <AppShell
      brandName="Store Manager"
      nav={NAV}
      title="Reports"
      subtitle={`Sales for ${storeName}, ${range.from} to ${range.to}. Sales are what customers paid (after discounts, VAT included); net takes off returns.`}
      actions={
        tab === "category" ? (
          <button type="button" onClick={exportCategory} disabled={!shown?.length}>
            Export CSV
          </button>
        ) : (
          <ExportMenu href={(format) => withQuery(salesReportUrl, { ...params, format })} />
        )
      }
    >
      <DateRange value={range} onChange={setRange} />
      <div className="field-row">
        <label style={{ maxWidth: 320 }}>
          Store
          <LocationPicker type="STORE" clearable placeholder="All stores" value={storeId} onChange={setStoreId} />
        </label>
      </div>

      <div className="actions" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={tab === t.key ? "primary" : undefined}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="error">{error}</p>}

      {shown === null ? (
        !error && <p className="muted">Loading…</p>
      ) : (
        <>
          <ChartCard
            title={`Net sales ${TABS.find((t) => t.key === tab)?.label.toLowerCase()}`}
            subtitle={tab === "hour" ? "Local time" : "Biggest first"}
            empty={shown.length === 0 ? "No sales in this period." : false}
            table={{
              columns: ["Group", "Net"],
              rows: shown.map((r) => [r.label, formatMoney(r.net)]),
            }}
          >
            <BarChart
              data={(tab === "hour" ? shown : shown.slice(0, 12)).map((r) => ({
                label: r.label,
                value: r.net,
                detail: `${r.units} unit(s)`,
              }))}
              format={(v) => formatMoney(v)}
            />
          </ChartCard>

          <div className="card" style={{ padding: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>{TABS.find((t) => t.key === tab)?.label.replace("By ", "").replace(/^\w/, (c) => c.toUpperCase())}</th>
                  {tab !== "category" && <th className="num">Sales count</th>}
                  <th className="num">Units</th>
                  <th className="num">Sales</th>
                  <th className="num">Discounts</th>
                  <th className="num">Returns</th>
                  <th className="num">Net</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.key}>
                    <td>{r.label}</td>
                    {tab !== "category" && <td className="num">{r.transactions}</td>}
                    <td className="num">{r.units}</td>
                    <td className="num">{formatMoney(r.sales)}</td>
                    <td className="num">{formatMoney(r.discounts)}</td>
                    <td className="num">{formatMoney(r.returns)}</td>
                    <td className="num">
                      <strong>{formatMoney(r.net)}</strong>
                    </td>
                  </tr>
                ))}
                {shown.length > 0 && (
                  <tr>
                    <td>
                      <strong>Total</strong>
                    </td>
                    {tab !== "category" && <td />}
                    <td className="num">{totals.units}</td>
                    <td className="num">{formatMoney(totals.sales)}</td>
                    <td className="num">{formatMoney(totals.discounts)}</td>
                    <td className="num">{formatMoney(totals.returns)}</td>
                    <td className="num">
                      <strong>{formatMoney(totals.net)}</strong>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </AppShell>
  );
}
