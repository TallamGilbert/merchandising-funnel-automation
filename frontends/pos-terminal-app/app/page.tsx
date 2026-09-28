"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Combobox,
  type ComboboxOption,
  formatDateTime,
  formatMoney,
  LocationPicker,
  lookupApi,
  RegisterPicker,
  StaffPicker,
  useFlash,
  usePolling,
} from "@mms/ui";
import { AppShell } from "../components/AppShell";
import { NAV } from "../lib/nav";
import { api, type PaymentMethodType, type Product } from "../lib/api";
import { activePromotion, computeLinePrice } from "../lib/pricing";
import { useTerminal } from "../lib/terminal";

const FEATURE_ENABLED = process.env.NEXT_PUBLIC_FEATURE_RETAIL_SALES_ENABLED !== "false";

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

interface Receipt {
  id: string;
  transactionNumber: string;
  totalAmount: string;
  createdAt: string;
}

export default function Page() {
  const flash = useFlash();
  const [terminal, setTerminal] = useTerminal();
  const { storeId, registerId, cashierId } = terminal;
  const [products, setProducts] = useState<Product[] | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [available, setAvailable] = useState<Map<string, number> | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([{ method: "CASH", amount: 0 }]);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);

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

  useEffect(() => {
    if (!FEATURE_ENABLED) return;
    api
      .listProducts()
      .then(setProducts)
      .catch((err: Error) => setCatalogError(`Could not load the price list: ${err.message}`));
  }, []);

  // What's on the shelf at this store, so the cashier sees stock before scanning.
  const loadStock = () => {
    if (!storeId) {
      setAvailable(null);
      return;
    }
    lookupApi
      .listStockLevels(storeId)
      .then((levels) => setAvailable(new Map(levels.map((l) => [l.sku, l.available]))))
      .catch(() => setAvailable(null));
  };
  useEffect(loadStock, [storeId]);
  usePolling(loadStock, 15000, FEATURE_ENABLED && Boolean(storeId));

  const productOptions: ComboboxOption[] = useMemo(
    () =>
      (products ?? []).map((p) => {
        const promo = activePromotion(p);
        const inStock = available?.get(p.sku);
        const inCart = cart.find((l) => l.sku === p.sku)?.quantity ?? 0;
        const stockNote =
          available === null ? null : inStock === undefined || inStock <= 0 ? "Out of stock" : `${inStock} in stock`;
        return {
          value: p.sku,
          label: p.name,
          description: [
            p.sku,
            formatMoney(p.unitPrice),
            promo ? `${Number(promo.discountPct)}% off` : null,
            stockNote,
            inCart ? `${inCart} in cart` : null,
          ]
            .filter(Boolean)
            .join(" · "),
          disabled: available !== null && (inStock ?? 0) <= inCart,
        };
      }),
    [products, available, cart],
  );

  // Stock the store holds that the price list doesn't know about — the usual
  // reason a freshly transferred item "isn't there" at the till.
  const unpriced = useMemo(() => {
    if (!available || !products) return [];
    const priced = new Set(products.map((p) => p.sku));
    return [...available.entries()].filter(([sku, qty]) => qty > 0 && !priced.has(sku)).map(([sku]) => sku);
  }, [available, products]);

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

  const addToCart = (sku: string) => {
    const product = products?.find((p) => p.sku === sku);
    if (!product) return;
    const promo = activePromotion(product);
    setReceipt(null);
    setCart((prev) => {
      const existing = prev.find((l) => l.sku === sku);
      if (existing) {
        return prev.map((l) => (l.sku === sku ? { ...l, quantity: l.quantity + 1 } : l));
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
      setReceipt({
        id: transaction.id,
        transactionNumber: transaction.transactionNumber,
        totalAmount: transaction.totalAmount,
        createdAt: transaction.createdAt,
      });
      flash.success(`Sale ${transaction.transactionNumber} complete — ${formatMoney(transaction.totalAmount)}`);
      setCart([]);
      setPayments([{ method: "CASH", amount: 0 }]);
      loadStock();
    } catch (err) {
      setCheckoutError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const ready = Boolean(storeId && registerId && cashierId);

  return (
    <AppShell
      brandName="POS"
      nav={NAV}
      title="Checkout"
      subtitle="Find items, capture payment, and complete the sale (FR-6.x)."
    >
      <div className="card">
        <div className="field-row">
          <label>
            Store
            <LocationPicker
              type="STORE"
              required
              value={storeId}
              // A different store has different tills and staff.
              onChange={(value) => setTerminal({ storeId: value, registerId: "", cashierId: "" })}
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
          <label>
            Cashier
            <StaffPicker
              required
              roles={["CASHIER", "MANAGER"]}
              locationCode={storeId || undefined}
              disabled={!storeId}
              placeholder={storeId ? "Search by name…" : "Choose a store first"}
              value={cashierId}
              onChange={(value) => setTerminal({ cashierId: value })}
            />
          </label>
        </div>
      </div>

      {receipt && (
        <div className="card">
          <h3 style={{ margin: 0 }}>Sale complete — {receipt.transactionNumber}</h3>
          <p className="muted" style={{ margin: 0 }}>
            Total charged: {formatMoney(receipt.totalAmount)} · {formatDateTime(receipt.createdAt)}
          </p>
          <p className="muted" style={{ margin: 0 }}>
            Transaction id (for returns): <code>{receipt.id}</code> ·{" "}
            <Link href={`/returns?transaction=${receipt.id}`}>Return items from this sale</Link>
          </p>
        </div>
      )}

      <div className="card">
        <h3 style={{ margin: 0 }}>Add an item</h3>
        <label>
          Scan a barcode, or search by product name or SKU
          <Combobox
            autoFocus
            clearOnSelect
            options={productOptions}
            loading={products === null && !catalogError}
            value=""
            placeholder="Scan, or start typing a product…"
            emptyMessage="No matching products"
            onChange={addToCart}
          />
        </label>
        {catalogError && <p className="error">{catalogError}</p>}
        {unpriced.length > 0 && (
          <p className="muted" style={{ margin: 0 }}>
            {unpriced.length === 1 ? "1 item" : `${unpriced.length} items`} in stock here can&apos;t be sold yet because{" "}
            {unpriced.length === 1 ? "it has" : "they have"} no price ({unpriced.slice(0, 3).join(", ")}
            {unpriced.length > 3 ? "…" : ""}). <Link href="/prices">Set prices</Link>
          </p>
        )}
      </div>

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
                <th className="num">Unit price</th>
                <th className="num">Discount</th>
                <th className="num">Tax</th>
                <th className="num">Line total</th>
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
                  <td className="num">{formatMoney(line.unitPrice)}</td>
                  <td className="num">{formatMoney(line.pricing.discountAmount)}</td>
                  <td className="num">{formatMoney(line.pricing.taxAmount)}</td>
                  <td className="num">{formatMoney(line.pricing.lineTotal)}</td>
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
          <strong className="num">Total: {formatMoney(total)}</strong>
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
              Amount (KES)
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
          <p className="error">
            Payments total {formatMoney(paymentsTotal)}, but the sale total is {formatMoney(total)}.
          </p>
        )}
        {!ready && <p className="muted" style={{ margin: 0 }}>Choose the store, register and cashier to take payment.</p>}
        {checkoutError && <p className="error">{checkoutError}</p>}
        <div className="actions">
          <button
            className="primary"
            disabled={busy || cart.length === 0 || !ready || paymentsTotal !== total}
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
