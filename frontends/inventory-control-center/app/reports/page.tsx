"use client";

import { useEffect, useMemo, useState } from "react";
import { ExportMenu, formatDateTime, formatMoney, LocationPicker, withQuery } from "@mms/ui";
import { AppShell } from "../../components/AppShell";
import { api, type MovementRow, type MovementStatus } from "../../lib/api";
import { NAV } from "../../lib/nav";

const STATUS: Record<MovementStatus, { label: string; badge: string; hint: string }> = {
  DEAD: { label: "Dead", badge: "badge danger", hint: "In stock but nothing sold in the window" },
  SLOW: { label: "Slow", badge: "badge warn", hint: "More days of cover than the threshold" },
  OK: { label: "Moving", badge: "badge ok", hint: "" },
};

const WINDOWS = [30, 60, 90, 180, 365];

/** D-20 — where money sits in stock that isn't selling. */
export default function StockMovementPage() {
  const [locationCode, setLocationCode] = useState("");
  const [category, setCategory] = useState("");
  const [days, setDays] = useState(90);
  const [slowAfterDays, setSlowAfterDays] = useState(90);
  const [statusFilter, setStatusFilter] = useState<MovementStatus | "">("");
  const [rows, setRows] = useState<MovementRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const params = {
    locationCode: locationCode || undefined,
    category: category.trim() || undefined,
    days,
    slowAfterDays,
  };

  useEffect(() => {
    setRows(null);
    setError(null);
    const timer = setTimeout(() => {
      api
        .stockMovement(params)
        .then(setRows)
        .catch((err: Error) => setError(err.message));
    }, 300); // category is typed
    return () => clearTimeout(timer);
  }, [locationCode, category, days, slowAfterDays]);

  const totals = useMemo(() => {
    const t = { DEAD: { lines: 0, value: 0 }, SLOW: { lines: 0, value: 0 }, OK: { lines: 0, value: 0 } };
    for (const r of rows ?? []) {
      t[r.status].lines++;
      t[r.status].value += r.stockValue;
    }
    return t;
  }, [rows]);

  const shown = (rows ?? []).filter((r) => !statusFilter || r.status === statusFilter);

  return (
    <AppShell
      brandName="Inventory"
      nav={NAV}
      title="Slow & dead stock"
      subtitle={`Everything in stock, measured against sales over the last ${days} days. Days of cover = on hand ÷ average daily sales.`}
      actions={
        <ExportMenu
          href={(format) =>
            withQuery(api.stockMovementUrl, { ...params, status: statusFilter || undefined, format })
          }
        />
      }
    >
      <div className="field-row">
        <label style={{ maxWidth: 320 }}>
          Location
          <LocationPicker clearable placeholder="All locations" value={locationCode} onChange={setLocationCode} />
        </label>
        <label style={{ maxWidth: 220 }}>
          Category
          <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="All categories" />
        </label>
        <label style={{ maxWidth: 180 }}>
          Sales window
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {WINDOWS.map((d) => (
              <option key={d} value={d}>
                Last {d} days
              </option>
            ))}
          </select>
        </label>
        <label style={{ maxWidth: 200 }}>
          Slow after (days of cover)
          <input
            type="number"
            min={1}
            value={slowAfterDays}
            onChange={(e) => setSlowAfterDays(Math.max(1, Number(e.target.value) || 1))}
          />
        </label>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="mms-chart-grid">
        {(["DEAD", "SLOW", "OK"] as MovementStatus[]).map((s) => (
          <button
            key={s}
            type="button"
            className="stat-card"
            style={{ textAlign: "left", cursor: "pointer", borderColor: statusFilter === s ? "var(--accent)" : undefined }}
            onClick={() => setStatusFilter((v) => (v === s ? "" : s))}
            aria-pressed={statusFilter === s}
          >
            <span className="muted">{STATUS[s].label} stock</span>
            <p className="stat-value">{formatMoney(totals[s].value)}</p>
            <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>
              {totals[s].lines} product-location(s){STATUS[s].hint ? ` · ${STATUS[s].hint.toLowerCase()}` : ""}
            </p>
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 0 }}>
        {rows === null ? (
          !error && <p className="muted" style={{ padding: "1.4rem" }}>Loading…</p>
        ) : shown.length === 0 ? (
          <p className="muted" style={{ padding: "1.4rem" }}>Nothing matches.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>SKU</th>
                <th>Product</th>
                <th>Location</th>
                <th className="num">On hand</th>
                <th className="num">Stock value</th>
                <th className="num">Sold ({days}d)</th>
                <th className="num">Days of cover</th>
                <th>Last sale</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={`${r.sku}|${r.locationCode}`}>
                  <td>
                    <span className={STATUS[r.status].badge}>{STATUS[r.status].label}</span>
                  </td>
                  <td>
                    <code>{r.sku}</code>
                  </td>
                  <td>
                    {r.productName}
                    {r.category && <div className="muted" style={{ fontSize: "0.78rem" }}>{r.category}</div>}
                  </td>
                  <td>{r.locationCode}</td>
                  <td className="num">{r.onHand}</td>
                  <td className="num">{formatMoney(r.stockValue)}</td>
                  <td className="num">{r.unitsSold}</td>
                  <td className="num">{r.daysOfCover ?? "—"}</td>
                  <td>{r.lastSaleAt ? formatDateTime(r.lastSaleAt) : <span className="muted">Never</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
