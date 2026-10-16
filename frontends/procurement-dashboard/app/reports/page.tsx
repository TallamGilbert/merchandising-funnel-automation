"use client";

import { useEffect, useMemo, useState } from "react";
import { DateRange, defaultRange, downloadCsv, formatMoney, type Range } from "@mms/ui";
import { AppShell } from "../../components/AppShell";
import { api, type SupplierOnTime, type SupplierPerformance } from "../../lib/api";
import { NAV } from "../../lib/nav";

/** Below these, a supplier is flagged. */
const FILL_RATE_TARGET = 0.9;
const ON_TIME_TARGET = 0.8;

interface ScoreRow {
  supplierId: string;
  supplierName: string;
  orders?: SupplierPerformance;
  delivery?: SupplierOnTime;
}

function pct(rate: number | null | undefined): string {
  return rate === null || rate === undefined ? "—" : `${Math.round(rate * 100)}%`;
}

/**
 * D-20 — each supplier's orders and fill rate (Procurement) next to their
 * on-time record (Vendor Management), for POs approved and deliveries made
 * in the period.
 */
export default function SupplierScorecardPage() {
  const [range, setRange] = useState<Range>(defaultRange);
  const [rows, setRows] = useState<ScoreRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRows(null);
    setError(null);
    void Promise.allSettled([api.supplierPerformance(range.from, range.to), api.supplierOnTime(range.from, range.to)]).then(
      ([orders, delivery]) => {
        // Either half can be missing (a module down); show what there is.
        const failed = [orders, delivery].filter((r) => r.status === "rejected") as PromiseRejectedResult[];
        if (failed.length) setError(failed.map((f) => (f.reason as Error).message).join(" · "));
        const merged = new Map<string, ScoreRow>();
        for (const o of orders.status === "fulfilled" ? orders.value : []) {
          merged.set(o.supplierId, { supplierId: o.supplierId, supplierName: o.supplierName, orders: o });
        }
        for (const d of delivery.status === "fulfilled" ? delivery.value : []) {
          const row = merged.get(d.supplierId) ?? { supplierId: d.supplierId, supplierName: d.supplierName };
          merged.set(d.supplierId, { ...row, delivery: d });
        }
        setRows([...merged.values()]);
      },
    );
  }, [range.from, range.to]);

  const sorted = useMemo(
    () =>
      [...(rows ?? [])].sort(
        (a, b) => (b.orders?.spendKes ?? 0) - (a.orders?.spendKes ?? 0) || a.supplierName.localeCompare(b.supplierName),
      ),
    [rows],
  );

  const exportCsv = () =>
    downloadCsv(
      "supplier-scorecard",
      [
        { header: "Supplier", value: (r: ScoreRow) => r.supplierName },
        { header: "Purchase orders", value: (r) => r.orders?.purchaseOrders },
        { header: "Open", value: (r) => r.orders?.openOrders },
        { header: "Closed", value: (r) => r.orders?.closedOrders },
        { header: "Spend (KES)", value: (r) => r.orders?.spendKes },
        { header: "Units ordered", value: (r) => r.orders?.unitsOrdered },
        { header: "Units received", value: (r) => r.orders?.unitsReceived },
        { header: "Fill rate (closed POs)", value: (r) => r.orders?.fillRate },
        { header: "Deliveries", value: (r) => r.delivery?.deliveries },
        { header: "On time", value: (r) => r.delivery?.onTime },
        { header: "On-time rate", value: (r) => r.delivery?.onTimeRate },
        { header: "Average days late", value: (r) => r.delivery?.averageDaysLate },
      ],
      sorted,
    );

  return (
    <AppShell
      brandName="Procurement"
      nav={NAV}
      title="Supplier scorecard"
      subtitle={`POs approved and deliveries made ${range.from} to ${range.to}. Fill rate counts closed POs only; flags show suppliers under ${pct(FILL_RATE_TARGET)} fill or ${pct(ON_TIME_TARGET)} on time.`}
      actions={
        <button type="button" onClick={exportCsv} disabled={!sorted.length}>
          Export CSV
        </button>
      }
    >
      <DateRange value={range} onChange={setRange} />
      {error && <p className="error">{error}</p>}

      <div className="card" style={{ padding: 0 }}>
        {rows === null ? (
          <p className="muted" style={{ padding: "1.4rem" }}>Loading…</p>
        ) : sorted.length === 0 ? (
          <p className="muted" style={{ padding: "1.4rem" }}>No orders or deliveries in this period.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Supplier</th>
                <th className="num">POs</th>
                <th className="num">Spend</th>
                <th className="num">Fill rate</th>
                <th className="num">Deliveries</th>
                <th className="num">On time</th>
                <th className="num">Avg days late</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const lowFill = r.orders?.fillRate !== null && r.orders?.fillRate !== undefined && r.orders.fillRate < FILL_RATE_TARGET;
                const late = r.delivery !== undefined && r.delivery.onTimeRate < ON_TIME_TARGET;
                return (
                  <tr key={r.supplierId}>
                    <td>{r.supplierName}</td>
                    <td className="num">
                      {r.orders ? (
                        <>
                          {r.orders.purchaseOrders}
                          <div className="muted" style={{ fontSize: "0.75rem" }}>
                            {r.orders.openOrders} open · {r.orders.closedOrders} closed
                          </div>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="num">
                      {r.orders ? formatMoney(r.orders.spendKes) : "—"}
                      {r.orders?.otherCurrencyOrders ? (
                        <div className="muted" style={{ fontSize: "0.75rem" }}>
                          + {r.orders.otherCurrencyOrders} in other currencies
                        </div>
                      ) : null}
                    </td>
                    <td className="num">
                      <span className={lowFill ? "badge warn" : undefined}>{pct(r.orders?.fillRate)}</span>
                    </td>
                    <td className="num">{r.delivery?.deliveries ?? "—"}</td>
                    <td className="num">
                      <span className={late ? "badge warn" : undefined}>{pct(r.delivery?.onTimeRate)}</span>
                    </td>
                    <td className="num">{r.delivery?.averageDaysLate ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
