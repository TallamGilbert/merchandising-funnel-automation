"use client";

import { useEffect, useMemo, useState } from "react";
import {
  type CatalogProduct,
  formatDate,
  formatMoney,
  formatQuantity,
  lookupApi,
  Modal,
  ProductPicker,
  type StockLevelSummary,
  useFlash,
  useLocations,
} from "@mms/ui";
import { AppShell } from "../../components/AppShell";
import { api, type Product, type Promotion } from "../../lib/api";
import { NAV } from "../../lib/nav";
import { activePromotion } from "../../lib/pricing";

const DEFAULT_TAX_PCT = 16; // Kenyan VAT

type Editing = { mode: "create"; sku?: string; name?: string } | { mode: "edit"; product: Product };

export default function PricesPage() {
  const flash = useFlash();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [stock, setStock] = useState<StockLevelSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Editing | null>(null);
  const [promoting, setPromoting] = useState<Product | null>(null);
  const { data: stores } = useLocations("STORE");

  const load = () => {
    api
      .listProducts()
      .then((rows) => {
        setProducts(rows);
        setError(null);
      })
      .catch((err: Error) => setError(err.message));
    // Inventory lookups only feed the "needs a price" hints — the page works without them.
    lookupApi.listCatalogProducts().then(setCatalog).catch(() => setCatalog([]));
    lookupApi.listStockLevels().then(setStock).catch(() => setStock([]));
  };
  useEffect(load, []);

  const storeCodes = useMemo(() => new Set(stores.map((s) => s.code)), [stores]);
  const storeName = (code: string) => stores.find((s) => s.code === code)?.name ?? code;

  /** Units on hand per SKU, counting stores only — that's what a till can sell. */
  const onShelves = useMemo(() => {
    const bySku = new Map<string, { total: number; where: string[] }>();
    for (const level of stock) {
      if (!storeCodes.has(level.locationCode) || level.onHand <= 0) continue;
      const entry = bySku.get(level.sku) ?? { total: 0, where: [] };
      entry.total += level.onHand;
      entry.where.push(`${formatQuantity(level.onHand)} at ${storeName(level.locationCode)}`);
      bySku.set(level.sku, entry);
    }
    return bySku;
    // storeName reads `stores`, already covered by storeCodes.
  }, [stock, storeCodes]);

  const priced = new Set((products ?? []).map((p) => p.sku));
  const needsPrice = catalog.filter((c) => !priced.has(c.sku) && onShelves.has(c.sku));

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (products ?? []).filter((p) => !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
  }, [products, search]);

  return (
    <AppShell
      brandName="POS"
      nav={NAV}
      title="Price list"
      subtitle="What each product sells for at the till. A product needs a price here before the POS can sell it."
      search={{ value: search, onChange: setSearch, placeholder: "Search the price list…" }}
      actions={
        <button className="primary" onClick={() => setEditing({ mode: "create" })}>
          Add to price list
        </button>
      }
    >
      {error && <p className="error">{error}</p>}

      {needsPrice.length > 0 && (
        <div className="card" style={{ borderColor: "var(--warn)", background: "var(--warn-soft)" }}>
          <h3 style={{ margin: 0 }}>In stock at a store, but not priced</h3>
          <p className="muted" style={{ margin: 0 }}>
            Cashiers can&apos;t sell these until they have a price.
          </p>
          <table>
            <tbody>
              {needsPrice.map((c) => (
                <tr key={c.sku}>
                  <td>
                    {c.name}
                    <div className="muted" style={{ fontSize: "0.78rem" }}>{c.sku}</div>
                  </td>
                  <td className="muted">{onShelves.get(c.sku)?.where.join(", ")}</td>
                  <td style={{ textAlign: "right" }}>
                    <button className="primary" onClick={() => setEditing({ mode: "create", sku: c.sku, name: c.name })}>
                      Set price
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        {products === null ? (
          <p className="muted" style={{ padding: "1.4rem" }}>Loading price list…</p>
        ) : visible.length === 0 ? (
          <p className="muted" style={{ padding: "1.4rem" }}>
            {products.length === 0 ? "Nothing is priced yet — add a product to start selling." : "No products match."}
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th className="num">Price</th>
                <th className="num">VAT</th>
                <th>Promotion</th>
                <th className="num">On store shelves</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => {
                const promo = activePromotion(p);
                const shelf = onShelves.get(p.sku);
                return (
                  <tr key={p.sku}>
                    <td>
                      {p.name}
                      <div className="muted" style={{ fontSize: "0.78rem" }}>{p.sku}</div>
                    </td>
                    <td className="num">{formatMoney(p.unitPrice)}</td>
                    <td className="num">{Number(p.taxRatePct)}%</td>
                    <td>
                      {promo ? (
                        <span className="badge ok">
                          {Number(promo.discountPct)}% off until {formatDate(promo.endsAt)}
                        </span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="num" title={shelf?.where.join(", ")}>
                      {shelf ? formatQuantity(shelf.total) : <span className="muted">None</span>}
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <button onClick={() => setEditing({ mode: "edit", product: p })}>Edit</button>{" "}
                      <button onClick={() => setPromoting(p)}>Promotions</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <PriceModal
          editing={editing}
          pricedSkus={[...priced]}
          onClose={() => setEditing(null)}
          onSaved={(product, created) => {
            setEditing(null);
            flash.success(
              created
                ? `${product.name} is now on sale at ${formatMoney(product.unitPrice)}`
                : `${product.name} updated — ${formatMoney(product.unitPrice)}`,
            );
            load();
          }}
        />
      )}

      {promoting && (
        <PromotionsModal
          product={promoting}
          onClose={() => setPromoting(null)}
          onAdded={(promo) => {
            setPromoting(null);
            flash.success(
              `${Number(promo.discountPct)}% off ${promoting.name} from ${formatDate(promo.startsAt)} to ${formatDate(promo.endsAt)}`,
            );
            load();
          }}
        />
      )}
    </AppShell>
  );
}

function PriceModal({
  editing,
  pricedSkus,
  onClose,
  onSaved,
}: {
  editing: Editing;
  pricedSkus: string[];
  onClose: () => void;
  onSaved: (product: Product, created: boolean) => void;
}) {
  const existing = editing.mode === "edit" ? editing.product : null;
  const [sku, setSku] = useState(existing?.sku ?? (editing.mode === "create" ? (editing.sku ?? "") : ""));
  const [name, setName] = useState(existing?.name ?? (editing.mode === "create" ? (editing.name ?? "") : ""));
  const [unitPrice, setUnitPrice] = useState(existing ? Number(existing.unitPrice) : 0);
  const [taxRatePct, setTaxRatePct] = useState(existing ? Number(existing.taxRatePct) : DEFAULT_TAX_PCT);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const product = existing
        ? await api.updateProduct(existing.sku, { name, unitPrice, taxRatePct })
        : await api.createProduct({ sku, name, unitPrice, taxRatePct });
      onSaved(product, !existing);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open title={existing ? `Edit price — ${existing.sku}` : "Add to price list"} onClose={onClose}>
      <form onSubmit={save}>
        {!existing && (
          <label>
            Product
            <ProductPicker
              required
              value={sku}
              excludeSkus={pricedSkus}
              onChange={setSku}
              onSelectProduct={(p) => setName(p?.name ?? "")}
            />
          </label>
        )}
        <label>
          Name on the receipt
          <input required value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="field-row">
          <label>
            Selling price (KES, before VAT)
            <input
              required
              type="number"
              min={0}
              step="0.01"
              value={unitPrice}
              onChange={(e) => setUnitPrice(Number(e.target.value))}
            />
          </label>
          <label style={{ maxWidth: 140 }}>
            VAT %
            <input
              required
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={taxRatePct}
              onChange={(e) => setTaxRatePct(Number(e.target.value))}
            />
          </label>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          Customer pays {formatMoney(Math.round(unitPrice * (1 + taxRatePct / 100) * 100) / 100)} per unit.
        </p>
        {error && <p className="error">{error}</p>}
        <div className="mms-modal-footer">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" type="submit" disabled={busy || !sku}>
            {busy ? "Saving…" : existing ? "Save price" : "Add to price list"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function promotionState(promo: Promotion): "Running" | "Upcoming" | "Ended" {
  const now = new Date();
  if (new Date(promo.startsAt) > now) return "Upcoming";
  return new Date(promo.endsAt) < now ? "Ended" : "Running";
}

function PromotionsModal({
  product,
  onClose,
  onAdded,
}: {
  product: Product;
  onClose: () => void;
  onAdded: (promo: Promotion) => void;
}) {
  const [discountPct, setDiscountPct] = useState(10);
  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState(todayIso());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const promotions = [...product.promotions].sort((a, b) => b.startsAt.localeCompare(a.startsAt));

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (endDate < startDate) {
      setError("The promotion must end on or after its start date");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Whole days in the till's own time zone: from opening on the first day to closing on the last.
      const promo = await api.addPromotion(product.sku, {
        discountPct,
        startsAt: new Date(`${startDate}T00:00:00`).toISOString(),
        endsAt: new Date(`${endDate}T23:59:59`).toISOString(),
      });
      onAdded(promo);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open title={`Promotions — ${product.name}`} onClose={onClose}>
      {promotions.length > 0 && (
        <table>
          <tbody>
            {promotions.map((promo) => {
              const state = promotionState(promo);
              return (
                <tr key={promo.id}>
                  <td>{Number(promo.discountPct)}% off</td>
                  <td className="muted">
                    {formatDate(promo.startsAt)} – {formatDate(promo.endsAt)}
                  </td>
                  <td>
                    <span className={`badge${state === "Running" ? " ok" : ""}`}>{state}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <form onSubmit={add}>
        <div className="field-row">
          <label style={{ maxWidth: 120 }}>
            Discount %
            <input
              required
              type="number"
              min={1}
              max={100}
              value={discountPct}
              onChange={(e) => setDiscountPct(Number(e.target.value))}
            />
          </label>
          <label>
            From
            <input required type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label>
            To
            <input required type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          Sells at {formatMoney(Math.round(Number(product.unitPrice) * (1 - discountPct / 100) * 100) / 100)} before VAT
          while it runs.
        </p>
        {error && <p className="error">{error}</p>}
        <div className="mms-modal-footer">
          <button type="button" onClick={onClose}>
            Close
          </button>
          <button className="primary" type="submit" disabled={busy}>
            {busy ? "Adding…" : "Add promotion"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
