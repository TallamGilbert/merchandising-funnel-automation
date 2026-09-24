"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell, type NavSection } from "../components/AppShell";
import { ArrowUturnLeftIcon, CartIcon } from "../components/icons";
import { api, type PaymentMethodType } from "../lib/api";
import { activePromotion, computeLinePrice } from "../lib/pricing";

const FEATURE_ENABLED = process.env.NEXT_PUBLIC_FEATURE_RETAIL_SALES_ENABLED !== "false";

const NAV: NavSection[] = [
  {
    label: "Main menu",
    items: [
      { label: "Checkout", href: "/", icon: <CartIcon /> },
      { label: "Returns", href: "/returns", icon: <ArrowUturnLeftIcon /> },
    ],
  },
];

interface CartLine {
  sku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  taxRatePct: number;
  discountPct: number | null;
}

interface PaymentRow {
  method: PaymentMethodType;
  amount: number;
}

export default function Page() {
  const [storeId, setStoreId] = useState("STORE-1");
  const [registerId, setRegisterId] = useState("REG-1");
  const [cashierId, setCashierId] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [sku, setSku] = useState("");
  const [scanError, setScanError] = useState<string | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([{ method: "CASH", amount: 0 }]);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<{ transactionNumber: string; totalAmount: string } | null>(null);
  const skuInput = useRef<HTMLInputElement>(null);

  const priced = useMemo(
    () =>
      cart.map((line) => ({
        ...line,
        pricing: computeLinePrice(line.unitPrice, line.quantity, line.discountPct, line.taxRatePct),
      })),
    [cart],
  );
  const total = useMemo(
    () => Math.round(priced.reduce((sum, l) => sum + l.pricing.lineTotal, 0) * 100) / 100,
    [priced],
  );
  const paymentsTotal = useMemo(
    () => Math.round(payments.reduce((sum, p) => sum + p.amount, 0) * 100) / 100,
    [payments],
  );

  useEffect(() => {
    // Single payment (the common case) auto-tracks the cart total; a split
    // payment's individual amounts become the cashier's own responsibility.
    setPayments((prev) => (prev.length === 1 ? [{ ...prev[0], amount: total }] : prev));
  }, [total]);

  if (!FEATURE_ENABLED) {
    return (
      <main className="page-body">
        <h1>Point of Sale Terminal</h1>
        <p>
          <strong>Phase 3 — Retail</strong> — this module is implemented, but its
          feature flag is currently off.
        </p>
        <p>
          Set <code>NEXT_PUBLIC_FEATURE_RETAIL_SALES_ENABLED=true</code> to view it.
        </p>
      </main>
    );
  }

  const scanSku = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = sku.trim();
    if (!code) return;
    setScanError(null);
    try {
      const product = await api.getProduct(code);
      const promo = activePromotion(product);
      setCart((prev) => {
        const existing = prev.find((l) => l.sku === code);
        if (existing) {
          return prev.map((l) => (l.sku === code ? { ...l, quantity: l.quantity + 1 } : l));
        }
        return [
          ...prev,
          {
            sku: product.sku,
            productName: product.name,
            quantity: 1,
            unitPrice: Number(product.unitPrice),
            taxRatePct: Number(product.taxRatePct),
            discountPct: promo ? Number(promo.discountPct) : null,
          },
        ];
      });
      setSku("");
    } catch (err) {
      setScanError((err as Error).message);
    } finally {
      skuInput.current?.focus();
    }
  };

  const updateQuantity = (targetSku: string, quantity: number) => {
    if (quantity < 1) return;
    setCart((prev) => prev.map((l) => (l.sku === targetSku ? { ...l, quantity } : l)));
  };

  const removeLine = (targetSku: string) => {
    setCart((prev) => prev.filter((l) => l.sku !== targetSku));
  };

  const addPaymentRow = () => {
    setPayments((prev) => [...prev, { method: "CARD", amount: 0 }]);
  };

  const completeSale = async () => {
    setBusy(true);
    setCheckoutError(null);
    try {
      const transaction = await api.checkout({
        storeId,
        registerId,
        cashierId,
        locationCode: storeId,
        lines: cart.map((l) => ({ sku: l.sku, quantity: l.quantity })),
        payments: payments.map((p) => ({ method: p.method, amount: p.amount })),
      });
      setReceipt({ transactionNumber: transaction.transactionNumber, totalAmount: transaction.totalAmount });
      setCart([]);
      setPayments([{ method: "CASH", amount: 0 }]);
    } catch (err) {
      setCheckoutError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell
      brandName="POS"
      nav={NAV}
      title="Checkout"
      subtitle="Scan items, capture payment, and complete the sale (FR-6.x)."
    >
      <div className="card">
        <div className="field-row">
          <label>
            Store
            <input value={storeId} onChange={(e) => setStoreId(e.target.value)} placeholder="e.g. STORE-1" />
          </label>
          <label>
            Register
            <input value={registerId} onChange={(e) => setRegisterId(e.target.value)} placeholder="e.g. REG-1" />
          </label>
          <label>
            Cashier
            <input
              value={cashierId}
              onChange={(e) => setCashierId(e.target.value)}
              placeholder="e.g. cashier-amy"
            />
          </label>
        </div>
      </div>

      {receipt && (
        <div className="card">
          <h3 style={{ margin: 0 }}>Sale complete — {receipt.transactionNumber}</h3>
          <p className="muted" style={{ margin: 0 }}>Total charged: {receipt.totalAmount}</p>
        </div>
      )}

      <form className="card" onSubmit={scanSku}>
        <h3 style={{ margin: 0 }}>Scan an item</h3>
        <div className="field-row">
          <label style={{ flex: 3 }}>
            Barcode / SKU
            <input
              ref={skuInput}
              autoFocus
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="Scan or type a SKU, then Enter"
              style={{ fontSize: "1.15rem", padding: "0.8rem 0.9rem" }}
              autoComplete="off"
            />
          </label>
        </div>
        {scanError && <p className="error">{scanError}</p>}
      </form>

      <div className="card" style={{ padding: 0 }}>
        {cart.length === 0 ? (
          <p className="muted" style={{ padding: "1.4rem" }}>Cart is empty.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Product</th>
                <th>Qty</th>
                <th>Unit price</th>
                <th>Discount</th>
                <th>Tax</th>
                <th>Line total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {priced.map((line) => (
                <tr key={line.sku}>
                  <td><code>{line.sku}</code></td>
                  <td>{line.productName}</td>
                  <td>
                    <input
                      type="number"
                      min={1}
                      value={line.quantity}
                      onChange={(e) => updateQuantity(line.sku, Number(e.target.value))}
                      style={{ width: 64 }}
                    />
                  </td>
                  <td>{line.unitPrice.toFixed(2)}</td>
                  <td>{line.pricing.discountAmount.toFixed(2)}</td>
                  <td>{line.pricing.taxAmount.toFixed(2)}</td>
                  <td>{line.pricing.lineTotal.toFixed(2)}</td>
                  <td>
                    <button type="button" onClick={() => removeLine(line.sku)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="row-between">
          <h3 style={{ margin: 0 }}>Payment</h3>
          <strong>Total: {total.toFixed(2)}</strong>
        </div>
        {payments.map((payment, i) => (
          <div className="field-row" key={i}>
            <label>
              Method
              <select
                value={payment.method}
                onChange={(e) =>
                  setPayments((prev) =>
                    prev.map((p, idx) => (idx === i ? { ...p, method: e.target.value as PaymentMethodType } : p)),
                  )
                }
              >
                <option value="CASH">Cash</option>
                <option value="CARD">Card</option>
                <option value="GIFT_CARD">Gift card</option>
              </select>
            </label>
            <label>
              Amount
              <input
                type="number"
                step="0.01"
                value={payment.amount}
                onChange={(e) =>
                  setPayments((prev) =>
                    prev.map((p, idx) => (idx === i ? { ...p, amount: Number(e.target.value) } : p)),
                  )
                }
              />
            </label>
          </div>
        ))}
        <div className="actions">
          <button type="button" onClick={addPaymentRow}>Split payment</button>
        </div>
        {paymentsTotal !== total && (
          <p className="error">Payments total {paymentsTotal.toFixed(2)}, but the sale total is {total.toFixed(2)}.</p>
        )}
        {checkoutError && <p className="error">{checkoutError}</p>}
        <div className="actions">
          <button
            className="primary"
            disabled={busy || cart.length === 0 || !cashierId || paymentsTotal !== total}
            onClick={completeSale}
            style={{ padding: "0.75rem 1.5rem" }}
          >
            {busy ? "Processing…" : "Complete sale"}
          </button>
        </div>
      </div>
    </AppShell>
  );
}
