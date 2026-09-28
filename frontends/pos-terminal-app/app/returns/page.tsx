"use client";

import { useState } from "react";
import { AppShell, type NavSection } from "../../components/AppShell";
import { ArrowUturnLeftIcon, CartIcon } from "../../components/icons";
import { api, type Transaction } from "../../lib/api";

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
  const [storeId, setStoreId] = useState("STORE-1");
  const [registerId, setRegisterId] = useState("REG-1");
  const [lookupId, setLookupId] = useState("");
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const lookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLookupError(null);
    setConfirmation(null);
    try {
      const found = await api.getTransaction(lookupId.trim());
      setTransaction(found);
      setQuantities({});
    } catch (err) {
      setTransaction(null);
      setLookupError((err as Error).message);
    }
  };

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
      setConfirmation("Return recorded. Stock has been returned to Available.");
      setTransaction(null);
      setQuantities({});
      setLookupId("");
    } catch (err) {
      setSubmitError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

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
            <input value={storeId} onChange={(e) => setStoreId(e.target.value)} />
          </label>
          <label>
            Register
            <input value={registerId} onChange={(e) => setRegisterId(e.target.value)} />
          </label>
        </div>
      </div>

      {confirmation && <p className="card">{confirmation}</p>}

      <form className="card" onSubmit={lookup}>
        <h3 style={{ margin: 0 }}>Look up a transaction</h3>
        <div className="field-row">
          <label style={{ flex: 3 }}>
            Transaction id
            <input
              value={lookupId}
              onChange={(e) => setLookupId(e.target.value)}
              placeholder="Transaction id from the receipt"
            />
          </label>
          <div className="actions">
            <button className="primary" type="submit">Look up</button>
          </div>
        </div>
        {lookupError && <p className="error">{lookupError}</p>}
      </form>

      {transaction && (
        <div className="card">
          <h3 style={{ margin: 0 }}>{transaction.transactionNumber}</h3>
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Product</th>
                <th>Sold</th>
                <th>Already returned</th>
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
                    <td>{line.quantitySold}</td>
                    <td>{line.quantityReturned}</td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        max={remaining}
                        disabled={remaining === 0}
                        value={quantities[line.id] ?? 0}
                        onChange={(e) =>
                          setQuantities((prev) => ({ ...prev, [line.id]: Number(e.target.value) }))
                        }
                        style={{ width: 64 }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {submitError && <p className="error">{submitError}</p>}
          <div className="actions">
            <button className="primary" disabled={busy} onClick={submitReturn} style={{ padding: "0.75rem 1.5rem" }}>
              {busy ? "Processing…" : "Process return"}
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
