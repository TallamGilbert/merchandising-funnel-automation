"use client";

import { useEffect, useState } from "react";
import { AppShell, type NavSection } from "../../components/AppShell";
import { ClipboardCheckIcon, StoreIcon } from "../../components/icons";
import { api, type CashierLedgerLine, type DailyClose } from "../../lib/api";

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

export default function ClosePage() {
  const [storeId, setStoreId] = useState("STORE-1");
  const [businessDate, setBusinessDate] = useState(todayIso());
  const [managerId, setManagerId] = useState("");
  const [close, setClose] = useState<DailyClose | null>(null);
  const [cashierLines, setCashierLines] = useState<CashierLedgerLine[]>([]);
  const [actualCountedTotal, setActualCountedTotal] = useState("");
  const [explanation, setExplanation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setError(null);
    Promise.all([
      api.getDailyClose(storeId, businessDate),
      api.getLedger(storeId, businessDate),
    ])
      .then(([dailyClose, ledger]) => {
        setClose(dailyClose);
        setCashierLines(ledger?.cashierLines ?? []);
      })
      .catch((err: Error) => setError(err.message));
  };

  useEffect(load, [storeId, businessDate]);

  const recordCount = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api.recordCount(storeId, businessDate, Number(actualCountedTotal));
      setClose(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const submitExplanation = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await api.explainDiscrepancy(storeId, businessDate, explanation);
      setClose(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const closeDay = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await api.closeDay(storeId, businessDate, managerId);
      setClose(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const discrepancy = close?.discrepancyAmount !== null && close?.discrepancyAmount !== undefined
    ? Number(close.discrepancyAmount)
    : null;
  const blocked = close?.status === "BLOCKED_ON_EXPLANATION";
  const closed = close?.status === "CLOSED";

  return (
    <AppShell
      brandName="Store Manager"
      nav={NAV}
      title="Close register"
      subtitle="Enter the physical count, resolve any discrepancy, and close the store for the day (FR-7.2/7.4/7.6)."
    >
      <div className="card">
        <div className="field-row">
          <label>
            Store
            <input value={storeId} onChange={(e) => setStoreId(e.target.value)} />
          </label>
          <label>
            Business date
            <input type="date" value={businessDate} onChange={(e) => setBusinessDate(e.target.value)} />
          </label>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {closed ? (
        <p className="card">
          <span className="badge ok">Closed</span> {storeId} is closed for {businessDate}.
        </p>
      ) : (
        <>
          <form className="card" onSubmit={recordCount}>
            <h3 style={{ margin: 0 }}>Physical count</h3>
            <p className="muted" style={{ margin: 0 }}>
              Total cash, card slips, and gift-card vouchers across every till (FR-7.2).
            </p>
            <div className="field-row">
              <label>
                Actual counted total
                <input
                  type="number"
                  step="0.01"
                  required
                  value={actualCountedTotal}
                  onChange={(e) => setActualCountedTotal(e.target.value)}
                />
              </label>
              <div className="actions">
                <button className="primary" type="submit" disabled={busy}>
                  {busy ? "Recording…" : "Record count"}
                </button>
              </div>
            </div>
          </form>

          {close && (
            <div className="card">
              <div className="row-between">
                <h3 style={{ margin: 0 }}>Discrepancy</h3>
                <span className={`badge${discrepancy === 0 ? " ok" : " warn"}`}>
                  {discrepancy === 0 ? "Balanced" : discrepancy !== null && discrepancy > 0 ? "Over" : "Short"}
                </span>
              </div>
              <p style={{ margin: 0 }}>
                Expected {close.expectedTotal} · Counted {close.actualCountedTotal} · Discrepancy {close.discrepancyAmount ?? "0.00"}
              </p>

              {blocked && (
                <>
                  <p className="muted" style={{ margin: 0 }}>
                    A nonzero discrepancy must be explained before this store can close (FR-7.4).
                  </p>
                  <label>
                    Explanation
                    <textarea
                      required
                      value={explanation}
                      onChange={(e) => setExplanation(e.target.value)}
                      placeholder="e.g. Till #2 miscounted on first pass, recounted and confirmed"
                      rows={3}
                    />
                  </label>
                  <div className="actions">
                    <button className="primary" disabled={busy || !explanation.trim()} onClick={submitExplanation}>
                      Submit explanation
                    </button>
                  </div>
                </>
              )}

              {close.discrepancyExplanation && !blocked && (
                <p className="muted" style={{ margin: 0 }}>Explanation: {close.discrepancyExplanation}</p>
              )}
            </div>
          )}

          {cashierLines.length > 0 && (
            <div className="card">
              <h3 style={{ margin: 0 }}>Per-cashier breakdown</h3>
              <p className="muted" style={{ margin: 0 }}>For pattern detection (FR-7.3) — closing itself is store-level.</p>
              <table>
                <thead>
                  <tr>
                    <th>Cashier</th>
                    <th>Register</th>
                    <th>Expected</th>
                  </tr>
                </thead>
                <tbody>
                  {cashierLines.map((line) => (
                    <tr key={line.id}>
                      <td>{line.cashierId}</td>
                      <td>{line.registerId}</td>
                      <td>{line.expectedAmount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {close && !blocked && (
            <div className="card">
              <label>
                Closing manager
                <input value={managerId} onChange={(e) => setManagerId(e.target.value)} placeholder="e.g. mgr-james" />
              </label>
              <div className="actions">
                <button
                  className="primary"
                  disabled={busy || !managerId}
                  onClick={closeDay}
                  style={{ padding: "0.75rem 1.5rem" }}
                >
                  {busy ? "Closing…" : "Close store"}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
