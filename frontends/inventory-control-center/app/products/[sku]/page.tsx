"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { formatMoney, formatQuantity, LocationPicker, useFlash, useLocations, usePolling } from "@mms/ui";
import { AppShell, type NavSection } from "../../../components/AppShell";
import { BoxesIcon, LayersIcon } from "../../../components/icons";
import { api, type ProductDetail } from "../../../lib/api";

const NAV: NavSection[] = [
  {
    label: "Main menu",
    items: [
      { label: "Products", href: "/", icon: <BoxesIcon /> },
      { label: "Stock levels", href: "/stock-levels", icon: <LayersIcon /> },
    ],
  },
];

export default function ProductPage({
  params,
}: {
  params: Promise<{ sku: string }>;
}) {
  const { sku } = use(params);
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const flash = useFlash();

  const load = () => {
    api
      .getProduct(sku)
      .then((p) => {
        setProduct(p);
        setError(null);
      })
      .catch((err: Error) => setError(err.message));
  };

  useEffect(load, [sku]);
  // Keeps stock levels current as the POS sells this product.
  usePolling(load, 5000, !editing);

  if (error) {
    return (
      <AppShell brandName="Inventory" nav={NAV} title="Product not found">
        <p className="error">{error}</p>
        <Link href="/">&larr; Back to products</Link>
      </AppShell>
    );
  }

  if (!product) {
    return (
      <AppShell brandName="Inventory" nav={NAV} title="Loading…">
        <p className="muted">Loading…</p>
      </AppShell>
    );
  }

  return (
    <AppShell
      brandName="Inventory"
      nav={NAV}
      title={product.name}
      subtitle={product.sku}
      actions={
        <button onClick={() => setEditing((v) => !v)}>{editing ? "Cancel" : "Edit"}</button>
      }
    >
      <Link href="/">&larr; Back to products</Link>

      {editing ? (
        <EditProductForm
          product={product}
          onSaved={() => {
            setEditing(false);
            flash.success("Product details saved");
            load();
          }}
        />
      ) : (
        <div className="card">
          <dl style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: "0.5rem 1rem", margin: 0 }}>
            <dt className="muted">Description</dt>
            <dd style={{ margin: 0 }}>{product.description ?? "—"}</dd>
            <dt className="muted">Unit cost</dt>
            <dd style={{ margin: 0 }}>{formatMoney(product.unitCost)}</dd>
            <dt className="muted">Dimensions (L×W×H cm)</dt>
            <dd style={{ margin: 0 }}>
              {product.lengthCm ?? "—"} × {product.widthCm ?? "—"} × {product.heightCm ?? "—"}
            </dd>
            <dt className="muted">Weight</dt>
            <dd style={{ margin: 0 }}>{product.weightKg ? `${product.weightKg} kg` : "—"}</dd>
            <dt className="muted">Sales velocity</dt>
            <dd style={{ margin: 0 }}>
              {product.salesVelocity
                ? `${Number(product.salesVelocity.unitsPerDay).toFixed(2)} units/day (${product.salesVelocity.windowDays}d window)`
                : "No sales recorded yet"}
            </dd>
          </dl>
        </div>
      )}

      <section>
        <h2>Stock levels</h2>
        <StockLevelsSection sku={sku} stockLevels={product.stockLevels} onChange={load} />
      </section>
    </AppShell>
  );
}

function EditProductForm({
  product,
  onSaved,
}: {
  product: ProductDetail;
  onSaved: () => void;
}) {
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description ?? "");
  const [unitCost, setUnitCost] = useState(Number(product.unitCost));
  const [weightKg, setWeightKg] = useState(product.weightKg ? Number(product.weightKg) : 0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.updateProduct(product.sku, { name, description, unitCost, weightKg });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="card" onSubmit={submit}>
      <div className="field-row">
        <label>
          Name
          <input required value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Description
          <input value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
      </div>
      <div className="field-row">
        <label>
          Unit cost (KES)
          <input
            required
            type="number"
            min={0}
            step="0.01"
            value={unitCost}
            onChange={(e) => setUnitCost(Number(e.target.value))}
          />
        </label>
        <label>
          Weight (kg)
          <input
            type="number"
            min={0}
            step="0.01"
            value={weightKg}
            onChange={(e) => setWeightKg(Number(e.target.value))}
          />
        </label>
      </div>
      {error && <p className="error">{error}</p>}
      <div>
        <button className="primary" type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

function StockLevelsSection({
  sku,
  stockLevels,
  onChange,
}: {
  sku: string;
  stockLevels: ProductDetail["stockLevels"];
  onChange: () => void;
}) {
  const flash = useFlash();
  const { data: directoryLocations } = useLocations();
  const locationName = (code: string) => {
    const location = directoryLocations.find((l) => l.code === code);
    return location ? `${location.name} (${code})` : code;
  };
  const [showForm, setShowForm] = useState(false);
  const [locationCode, setLocationCode] = useState("");
  const [quantityDelta, setQuantityDelta] = useState(0);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.adjustStock(sku, { locationCode, quantityDelta, reason });
      flash.success(
        `Stock at ${locationName(locationCode)} ${quantityDelta >= 0 ? "increased" : "decreased"} by ${Math.abs(quantityDelta)}`,
      );
      setLocationCode("");
      setQuantityDelta(0);
      setReason("");
      setShowForm(false);
      onChange();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {stockLevels.length === 0 ? (
        <p className="muted">No stock recorded at any location yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Location</th>
              <th className="num">On hand</th>
              <th className="num">Allocated</th>
              <th className="num">Available</th>
            </tr>
          </thead>
          <tbody>
            {stockLevels.map((level) => (
              <tr key={level.id}>
                <td>{locationName(level.locationCode)}</td>
                <td className="num">{formatQuantity(level.onHand)}</td>
                <td className="num">{formatQuantity(level.allocated)}</td>
                <td className="num">{formatQuantity(level.available)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showForm ? (
        <form className="card" onSubmit={submit}>
          <h3 style={{ margin: 0 }}>Adjust stock</h3>
          <div className="field-row">
            <label>
              Location
              <LocationPicker required value={locationCode} onChange={setLocationCode} />
            </label>
            <label>
              Quantity delta
              <input
                required
                type="number"
                value={quantityDelta}
                onChange={(e) => setQuantityDelta(Number(e.target.value))}
                placeholder="Positive to add, negative to remove"
              />
            </label>
          </div>
          <div className="field-row">
            <label>
              Reason
              <input
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. physical count correction"
              />
            </label>
          </div>
          {error && <p className="error">{error}</p>}
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button className="primary" type="submit" disabled={submitting}>
              {submitting ? "Applying…" : "Apply adjustment"}
            </button>
            <button type="button" onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div>
          <button onClick={() => setShowForm(true)}>Adjust stock</button>
        </div>
      )}
    </div>
  );
}
