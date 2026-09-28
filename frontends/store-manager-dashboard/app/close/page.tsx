"use client";

import { useEffect, useState } from "react";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatSignedMoney,
  LocationPicker,
  StaffPicker,
  useFlash,
  useLocations,
  useStaffNames,
} from "@mms/ui";
import { AppShell } from "../../components/AppShell";
import { api, type CashierLedgerLine, type DailyClose } from "../../lib/api";
import { NAV } from "../../lib/nav";
import { useSelectedStore } from "../../lib/store";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ClosePage() {
  const [storeId, setStoreId] = useSelectedStore();
  const flash = useFlash();
  const nameOf = useStaffNames();
  const { data: stores } = useLocations("STORE");
  const store = stores.find((s) => s.code === storeId);
  const registerName = (code: string) => store?.registers.find((r) => r.code === code)?.name ?? code;
  const [businessDate, setBusinessDate] = useState(todayIso());
  const [managerId, setManagerId] = useState("");
  const [close, setClose] = useState<DailyClose | null>(null);
  const [cashierLines, setCashierLines] = useState<CashierLedgerLine[]>([]);
  const [actualCountedTotal, setActualCountedTotal] = useState("");
  const [explanation, setExplanation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    if (!storeId) return;
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
      const off = Number(result.discrepancyAmount ?? 0);
      if (off === 0) flash.success("Count recorded — the store balances");
      else flash.info(`Count recorded — ${formatSignedMoney(off)} against expected. Explain it before closing.`);
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
      flash.success("Explanation saved — the store can now be closed");
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
      flash.success(`${store?.name ?? storeId} closed for ${formatDate(businessDate)}`);
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
            <LocationPicker type="STORE" value={storeId} onChange={setStoreId} />
          </label>
          <label>
            Business date
            <input type="date" value={businessDate} onChange={(e) => setBusinessDate(e.target.value)} />
          </label>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {!storeId ? (
        <p className="card muted">Choose a store to close.</p>
      ) : closed ? (
        <p className="card">
          <span className="badge ok">Closed</span> {store?.name ?? storeId} is closed for {formatDate(businessDate)}
          {close?.closedByManagerId && ` — by ${nameOf(close.closedByManagerId)}`}
          {close?.closedAt && ` on ${formatDateTime(close.closedAt)}`}.
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
                Actual counted total (KES)
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
                Expected {formatMoney(close.expectedTotal)} · Counted {formatMoney(close.actualCountedTotal)} ·
                Discrepancy <strong>{formatSignedMoney(close.discrepancyAmount ?? 0)}</strong>
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
                    <th className="num">Expected</th>
                  </tr>
                </thead>
                <tbody>
                  {cashierLines.map((line) => (
                    <tr key={line.id}>
                      <td>{nameOf(line.cashierId)}</td>
                      <td>{registerName(line.registerId)}</td>
                      <td className="num">{formatMoney(line.expectedAmount)}</td>
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
                <StaffPicker
                  required
                  roles={["MANAGER", "OWNER"]}
                  value={managerId}
                  onChange={setManagerId}
                />
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
