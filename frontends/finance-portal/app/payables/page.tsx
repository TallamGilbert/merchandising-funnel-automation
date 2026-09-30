"use client";

import { useEffect, useState } from "react";
import { BarChart, ChartCard, formatDate, formatMoney, Modal, useFlash } from "@mms/ui";
import { AppShell } from "../../components/AppShell";
import { type AgingBucket, type AgingReport, api, type BillStatus, type PayableBill } from "../../lib/financials-client";
import { NAV } from "../../lib/nav";

const BUCKET_LABEL: Record<AgingBucket, string> = {
  current: "Not yet due",
  "1-30": "1–30 days overdue",
  "31-60": "31–60 days overdue",
  "61-90": "61–90 days overdue",
  "90+": "Over 90 days overdue",
};

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function PayablesPage() {
  const flash = useFlash();
  const [aging, setAging] = useState<AgingReport | null>(null);
  const [bills, setBills] = useState<PayableBill[] | null>(null);
  const [status, setStatus] = useState<BillStatus | "">("OPEN");
  const [search, setSearch] = useState("");
  const [paying, setPaying] = useState<PayableBill | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    Promise.all([api.aging(), api.payables(status || undefined)])
      .then(([report, list]) => {
        setAging(report);
        setBills(list);
        setError(null);
      })
      .catch((err: Error) => setError(err.message));
  };
  useEffect(load, [status]);

  const q = search.trim().toLowerCase();
  const visible = (bills ?? []).filter(
    (b) =>
      !q ||
      b.supplierName.toLowerCase().includes(q) ||
      b.poNumber.toLowerCase().includes(q) ||
      b.goodsReceivedNoteNumber.toLowerCase().includes(q),
  );

  return (
    <AppShell
      brandName="Finance"
      nav={NAV}
      title="Accounts payable"
      subtitle="What's owed to each supplier and when it's due (FR-8.4). A bill is raised automatically for every goods received note."
      search={{ value: search, onChange: setSearch, placeholder: "Search supplier, PO or GRN…" }}
    >
      {error && <p className="error">{error}</p>}

      {aging && (
        <div className="mms-chart-grid">
          <div className="stat-card">
            <span className="muted">Owed to suppliers</span>
            <p className="stat-value">{formatMoney(aging.totalOutstanding)}</p>
            <p className="muted" style={{ margin: 0 }}>
              {formatMoney(aging.totalOutstanding - aging.totals.current)} of it overdue
            </p>
          </div>
          <ChartCard
            title="How overdue"
            subtitle="Open balances by age"
            empty={aging.totalOutstanding === 0 ? "Nothing owed right now." : false}
            table={{
              columns: ["Age", "Owed"],
              rows: aging.buckets.map((b) => [BUCKET_LABEL[b], formatMoney(aging.totals[b])]),
            }}
          >
            <BarChart
              data={aging.buckets.map((b) => ({ label: BUCKET_LABEL[b], value: aging.totals[b] }))}
              format={(v) => formatMoney(v)}
            />
          </ChartCard>
        </div>
      )}

      {aging && aging.suppliers.length > 0 && (
        <div className="card" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Supplier</th>
                {aging.buckets.map((b) => (
                  <th key={b} className="num">{b === "current" ? "Not yet due" : `${b} days`}</th>
                ))}
                <th className="num">Total owed</th>
              </tr>
            </thead>
            <tbody>
              {aging.suppliers.map((s) => (
                <tr key={s.supplierId}>
                  <td>{s.supplierName}</td>
                  {aging.buckets.map((b) => (
                    <td key={b} className="num">{s.buckets[b] ? formatMoney(s.buckets[b]) : <span className="muted">—</span>}</td>
                  ))}
                  <td className="num"><strong>{formatMoney(s.total)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="row-between">
        <h2 style={{ margin: 0 }}>Bills</h2>
        <label style={{ maxWidth: 200 }}>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value as BillStatus | "")}>
            <option value="OPEN">Open</option>
            <option value="PAID">Paid</option>
            <option value="">All</option>
          </select>
        </label>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {bills === null ? (
          <p className="muted" style={{ padding: "1.4rem" }}>Loading bills…</p>
        ) : visible.length === 0 ? (
          <p className="muted" style={{ padding: "1.4rem" }}>No bills found.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Supplier</th>
                <th>For</th>
                <th>Received</th>
                <th>Due</th>
                <th className="num">Amount</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((b) => (
                <tr key={b.id}>
                  <td>{b.supplierName}</td>
                  <td>
                    {b.goodsReceivedNoteNumber}
                    <div className="muted" style={{ fontSize: "0.78rem" }}>{b.poNumber}</div>
                  </td>
                  <td>{formatDate(b.billDate)}</td>
                  <td>
                    {formatDate(b.dueDate)}
                    <div style={{ marginTop: 4 }}>
                      {b.status === "PAID" ? (
                        <span className="badge ok">Paid {formatDate(b.paidAt)}</span>
                      ) : b.daysOverdue > 0 ? (
                        <span className="badge danger">{b.daysOverdue} day{b.daysOverdue === 1 ? "" : "s"} overdue</span>
                      ) : (
                        <span className="badge">Not yet due</span>
                      )}
                    </div>
                  </td>
                  <td className="num">{formatMoney(b.amount, b.currency)}</td>
                  <td style={{ textAlign: "right" }}>
                    {b.status === "OPEN" && (
                      <button className="primary" onClick={() => setPaying(b)}>
                        Record payment
                      </button>
                    )}
                    {b.status === "PAID" && b.paymentReference && <span className="muted">Ref {b.paymentReference}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {paying && (
        <PayModal
          bill={paying}
          onClose={() => setPaying(null)}
          onPaid={() => {
            flash.success(`Paid ${paying.supplierName} ${formatMoney(paying.amount, paying.currency)} for ${paying.goodsReceivedNoteNumber}`);
            setPaying(null);
            load();
          }}
        />
      )}
    </AppShell>
  );
}

function PayModal({ bill, onClose, onPaid }: { bill: PayableBill; onClose: () => void; onPaid: () => void }) {
  const [paymentReference, setPaymentReference] = useState("");
  const [paidOn, setPaidOn] = useState(todayIso());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pay = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.payBill(bill.id, { paymentReference: paymentReference.trim() || undefined, paidOn });
      onPaid();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open title={`Pay ${bill.supplierName}`} onClose={onClose}>
      <form onSubmit={pay}>
        <p style={{ margin: 0 }}>
          <strong>{formatMoney(bill.amount, bill.currency)}</strong> for {bill.goodsReceivedNoteNumber} ({bill.poNumber}),
          due {formatDate(bill.dueDate)}.
        </p>
        <div className="field-row">
          <label>
            Paid on
            <input required type="date" value={paidOn} max={todayIso()} onChange={(e) => setPaidOn(e.target.value)} />
          </label>
          <label>
            Payment reference
            <input value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} placeholder="e.g. bank or M-Pesa ref" />
          </label>
        </div>
        <p className="muted" style={{ margin: 0 }}>Posts to the ledger: accounts payable down, bank down.</p>
        {error && <p className="error">{error}</p>}
        <div className="mms-modal-footer">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" type="submit" disabled={busy}>
            {busy ? "Recording…" : "Record payment"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
