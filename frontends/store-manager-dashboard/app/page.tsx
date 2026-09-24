"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell, type NavSection } from "../components/AppShell";
import { ClipboardCheckIcon, StoreIcon } from "../components/icons";
import { api, type StoreDayLedger } from "../lib/api";

const FEATURE_ENABLED = process.env.NEXT_PUBLIC_FEATURE_SALES_AUDIT_ENABLED !== "false";

const NAV: NavSection[] = [
  {
    label: "Main menu",
    items: [
      { label: "Overview", href: "/", icon: <StoreIcon /> },
      { label: "Close register", href: "/close", icon: <ClipboardCheckIcon /> },
    ],
  },
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function Page() {
  const router = useRouter();
  const [storeId, setStoreId] = useState("STORE-1");
  const [businessDate, setBusinessDate] = useState(todayIso());
  const [ledger, setLedger] = useState<StoreDayLedger | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    if (!FEATURE_ENABLED) return;
    setError(null);
    api
      .getLedger(storeId, businessDate)
      .then(setLedger)
      .catch((err: Error) => setError(err.message));
  };

  useEffect(load, [storeId, businessDate]);

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
            <input value={storeId} onChange={(e) => setStoreId(e.target.value)} placeholder="e.g. STORE-1" />
          </label>
          <label>
            Business date
            <input type="date" value={businessDate} onChange={(e) => setBusinessDate(e.target.value)} />
          </label>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="card">
        {ledger === undefined ? (
          <p className="muted" style={{ margin: 0 }}>Loading…</p>
        ) : ledger === null ? (
          <p className="muted" style={{ margin: 0 }}>No sales recorded yet for {storeId} on {businessDate}.</p>
        ) : (
          <>
            <h3 style={{ margin: 0 }}>Expected total so far</h3>
            <p style={{ fontSize: "2rem", margin: "0.5rem 0" }}>{ledger.expectedTotal}</p>
            <table>
              <thead>
                <tr>
                  <th>Cashier</th>
                  <th>Register</th>
                  <th>Expected</th>
                </tr>
              </thead>
              <tbody>
                {ledger.cashierLines.map((line) => (
                  <tr key={line.id}>
                    <td>{line.cashierId}</td>
                    <td>{line.registerId}</td>
                    <td>{line.expectedAmount}</td>
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
