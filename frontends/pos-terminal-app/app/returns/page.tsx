"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Combobox,
  type ComboboxOption,
  formatDateTime,
  formatMoney,
  LocationPicker,
  RegisterPicker,
  useFlash,
  useStaffNames,
} from "@mms/ui";
import { AppShell, type NavSection } from "../../components/AppShell";
import { ArrowUturnLeftIcon, CartIcon } from "../../components/icons";
import { api, type Transaction } from "../../lib/api";
import { useTerminal } from "../../lib/terminal";

const NAV: NavSection[] = [
  {
    label: "Main menu",
    items: [
      { label: "Checkout", href: "/", icon: <CartIcon /> },
      { label: "Returns", href: "/returns", icon: <ArrowUturnLeftIcon /> },
    ],
  },
];

export default function ReturnsPage() {
  const flash = useFlash();
  const nameOf = useStaffNames();
  const [terminal, setTerminal] = useTerminal();
  const { storeId, registerId } = terminal;
  const [recent, setRecent] = useState<Transaction[] | null>(null);
  const [recentError, setRecentError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadRecent = () => {
    if (!storeId) return;
    api
      .listRecentTransactions(storeId)
      .then((rows) => {
        setRecent(rows);
        setRecentError(null);
      })
      .catch((err: Error) => setRecentError(err.message));
  };
  useEffect(loadRecent, [storeId]);

  const select = async (id: string) => {
    setSelectedId(id);
    setLookupError(null);
    setQuantities({});
    if (!id) {
      setTransaction(null);
      return;
    }
    try {
      setTransaction(await api.getTransaction(id));
    } catch (err) {
      setTransaction(null);
      setLookupError((err as Error).message);
    }
  };

  // Arriving from a receipt's "Return items from this sale" link.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("transaction");
    if (id) void select(id);
  }, []);

  const options: ComboboxOption[] = useMemo(
    () =>
      (recent ?? []).map((t) => ({
        value: t.id,
        label: `${t.transactionNumber} — ${formatMoney(t.totalAmount)}`,
        description: [
          formatDateTime(t.createdAt),
          t.lines.map((l) => `${l.quantitySold} × ${l.productName}`).join(", "),
          nameOf(t.cashierId),
          t.status === "RETURNED" ? "fully returned" : null,
        ]
          .filter(Boolean)
          .join(" · "),
        disabled: t.status === "RETURNED",
      })),
    [recent, nameOf],
  );

  const submitReturn = async () => {
    if (!transaction) return;
    const lines = Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([transactionLineId, quantityReturned]) => ({ transactionLineId, quantityReturned }));
    if (lines.length === 0) {
      setSubmitError("Enter a quantity to return on at least one line");
      return;
    }

    setBusy(true);
    setSubmitError(null);
    try {
      await api.processReturn({ originalTransactionId: transaction.id, storeId, registerId, lines });
      const units = lines.reduce((sum, l) => sum + l.quantityReturned, 0);
      flash.success(
        `Return on ${transaction.transactionNumber} recorded — ${units} item${units === 1 ? "" : "s"} back in stock`,
      );
      setTransaction(null);
      setSelectedId("");
      setQuantities({});
      loadRecent();
    } catch (err) {
      setSubmitError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Same rounding as the server: each line's share of what was paid, to the cent.
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const refund = transaction
    ? round2(
        transaction.lines.reduce(
          (sum, line) => sum + round2((Number(line.lineTotal) / line.quantitySold) * (quantities[line.id] ?? 0)),
          0,
        ),
      )
    : 0;

  return (
    <AppShell
      brandName="POS"
      nav={NAV}
      title="Returns"
      subtitle="Reverses part or all of an earlier sale; stock goes back to Available immediately (D-5)."
    >
      <div className="card">
        <div className="field-row">
          <label>
            Store
            <LocationPicker
              type="STORE"
              required
              value={storeId}
              onChange={(value) => {
                setTerminal({ storeId: value, registerId: "", cashierId: "" });
                void select("");
              }}
            />
          </label>
          <label>
            Register
            <RegisterPicker
              required
              locationCode={storeId}
              value={registerId}
              onChange={(value) => setTerminal({ registerId: value })}
            />
          </label>
        </div>
      </div>

      <div className="card">
        <h3 style={{ margin: 0 }}>Find the sale</h3>
        <label>
          Search by receipt number, item or cashier
          <Combobox
            options={options}
            value={selectedId}
            onChange={(id) => void select(id)}
            clearable
            disabled={!storeId}
            loading={Boolean(storeId) && recent === null && !recentError}
            placeholder={storeId ? "e.g. TXN-1001 or Oak Chair…" : "Choose a store first"}
            emptyMessage="No matching sales at this store"
          />
        </label>
        {recentError && <p className="error">Could not load recent sales: {recentError}</p>}
        {lookupError && <p className="error">{lookupError}</p>}
      </div>

      {transaction && (
        <div className="card">
          <div className="row-between">
            <h3 style={{ margin: 0 }}>{transaction.transactionNumber}</h3>
            <span className="muted">
              {formatDateTime(transaction.createdAt)} · {nameOf(transaction.cashierId)} ·{" "}
              {formatMoney(transaction.totalAmount)}
            </span>
          </div>
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Product</th>
                <th className="num">Sold</th>
                <th className="num">Already returned</th>
                <th className="num">Paid</th>
                <th>Return qty</th>
              </tr>
            </thead>
            <tbody>
              {transaction.lines.map((line) => {
                const remaining = line.quantitySold - line.quantityReturned;
                return (
                  <tr key={line.id}>
                    <td><code>{line.sku}</code></td>
                    <td>{line.productName}</td>
                    <td className="num">{line.quantitySold}</td>
                    <td className="num">{line.quantityReturned}</td>
                    <td className="num">{formatMoney(line.lineTotal)}</td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        max={remaining}
                        disabled={remaining === 0}
                        value={quantities[line.id] ?? 0}
                        onChange={(e) =>
                          setQuantities((prev) => ({
                            ...prev,
                            [line.id]: Math.min(Math.max(Number(e.target.value), 0), remaining),
                          }))
                        }
                        style={{ width: 64 }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <p style={{ margin: 0 }}>
            Refund due: <strong className="num">{formatMoney(refund)}</strong>
          </p>
          {!registerId && <p className="muted" style={{ margin: 0 }}>Choose the register handing out the refund.</p>}
          {submitError && <p className="error">{submitError}</p>}
          <div className="actions">
            <button
              className="primary"
              disabled={busy || !registerId}
              onClick={submitReturn}
              style={{ padding: "0.75rem 1.5rem" }}
            >
              {busy ? "Processing…" : "Process return"}
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
