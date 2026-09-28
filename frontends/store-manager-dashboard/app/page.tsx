"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { formatDate, formatMoney, LocationPicker, useLocations, usePolling, useStaffNames } from "@mms/ui";
import { AppShell } from "../components/AppShell";
import { api, type StoreDayLedger } from "../lib/api";
import { NAV } from "../lib/nav";
import { useSelectedStore } from "../lib/store";

const FEATURE_ENABLED = process.env.NEXT_PUBLIC_FEATURE_SALES_AUDIT_ENABLED !== "false";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function Page() {
  const router = useRouter();
  const [storeId, setStoreId] = useSelectedStore();
  const nameOf = useStaffNames();
  const { data: stores } = useLocations("STORE");
  const registerName = (code: string) =>
    stores.find((s) => s.code === storeId)?.registers.find((r) => r.code === code)?.name ?? code;
  const [businessDate, setBusinessDate] = useState(todayIso());
  const [ledger, setLedger] = useState<StoreDayLedger | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    if (!FEATURE_ENABLED || !storeId) return;
    api
      .getLedger(storeId, businessDate)
      .then((result) => {
        setLedger(result);
        setError(null);
      })
      .catch((err: Error) => setError(err.message));
  };

  useEffect(load, [storeId, businessDate]);
  // The ledger grows with every ItemSold — keep the running total live.
  usePolling(load, 10000, FEATURE_ENABLED && Boolean(storeId));

  if (!FEATURE_ENABLED) {
    return (
      <main className="page-body">
        <h1>Store Manager Dashboard</h1>
        <p>
          <strong>Phase 3 — Retail</strong> — this module is implemented, but its
          feature flag is currently off.
        </p>
        <p>
          Set <code>NEXT_PUBLIC_FEATURE_SALES_AUDIT_ENABLED=true</code> to view it.
        </p>
      </main>
    );
  }

  return (
    <AppShell
      brandName="Store Manager"
      nav={NAV}
      title="Overview"
      subtitle="Today's running expected total, kept current as sales come in (FR-7.7)."
    >
      <div className="card">
        <div className="field-row">
          <label>
            Store
            <LocationPicker type="STORE" value={storeId} onChange={setStoreId} />
          </label>
          <label>
            Business date
            <input type="date" value={businessDate} onChange={(e) => setBusinessDate(e.target.value)} />
          </label>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="card">
        {!storeId ? (
          <p className="muted" style={{ margin: 0 }}>Choose a store to see its day.</p>
        ) : ledger === undefined ? (
          <p className="muted" style={{ margin: 0 }}>Loading…</p>
        ) : ledger === null ? (
          <p className="muted" style={{ margin: 0 }}>No sales recorded yet on {formatDate(businessDate)}.</p>
        ) : (
          <>
            <h3 style={{ margin: 0 }}>Expected total so far</h3>
            <p className="num" style={{ fontSize: "2rem", margin: "0.5rem 0" }}>{formatMoney(ledger.expectedTotal)}</p>
            <table>
              <thead>
                <tr>
                  <th>Cashier</th>
                  <th>Register</th>
                  <th className="num">Expected</th>
                </tr>
              </thead>
              <tbody>
                {ledger.cashierLines.map((line) => (
                  <tr key={line.id}>
                    <td>{nameOf(line.cashierId)}</td>
                    <td>{registerName(line.registerId)}</td>
                    <td className="num">{formatMoney(line.expectedAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      <div className="actions">
        <button className="primary" onClick={() => router.push("/close")} style={{ padding: "0.75rem 1.5rem" }}>
          Start close
        </button>
      </div>
    </AppShell>
  );
}
