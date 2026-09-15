"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell, type NavSection } from "../components/AppShell";
import { BoxesIcon, LayersIcon } from "../components/icons";
import { api, type Product, type ValuationReport } from "../lib/api";

const FEATURE_ENABLED = process.env.NEXT_PUBLIC_FEATURE_INVENTORY_ENABLED !== "false";

const NAV: NavSection[] = [
  {
    label: "Main menu",
    items: [
      { label: "Products", href: "/", icon: <BoxesIcon /> },
      { label: "Stock levels", href: "/stock-levels", icon: <LayersIcon /> },
    ],
  },
];

export default function Page() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = () => {
    setError(null);
    api.listProducts().then(setProducts).catch((err: Error) => setError(err.message));
  };

  useEffect(() => {
    if (FEATURE_ENABLED) load();
  }, []);

  const visible = useMemo(() => {
    if (!products) return null;
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q),
    );
  }, [products, search]);

  if (!FEATURE_ENABLED) {
    return (
      <main className="page-body">
        <h1>Inventory Control Center</h1>
        <p>
          <strong>Phase 1 — Foundation</strong> — this module is implemented, but its
          feature flag is currently off.
        </p>
        <p>
          Set <code>NEXT_PUBLIC_FEATURE_INVENTORY_ENABLED=true</code> to view it.
        </p>
      </main>
    );
  }

  return (
    <AppShell
      brandName="Inventory"
      nav={NAV}
      statusCard={{
        title: "Phase 1 — Foundation",
        description: "Stock, valuation, and product master data (FR-4.x). API docs available.",
        href: (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3003") + "/docs",
        linkLabel: "View API docs ↗",
      }}
      title="Welcome back"
      subtitle="Browse stock levels, perform adjustments, and view valuation."
      search={{ value: search, onChange: setSearch, placeholder: "Search products…" }}
      actions={
        <button className="primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "New product"}
        </button>
      }
    >
      {showForm && (
        <NewProductForm
          onCreated={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      {error && <p className="error">{error}</p>}

      <ValuationSummary />

      <div className="card" style={{ padding: 0 }}>
        {visible === null ? (
          <p className="muted" style={{ padding: "1.4rem" }}>
            Loading products…
          </p>
        ) : visible.length === 0 ? (
          <p className="muted" style={{ padding: "1.4rem" }}>
            No products found.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Name</th>
                <th>Unit cost</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => (
                <tr key={p.id}>
                  <td>
                    <code>{p.sku}</code>
                  </td>
                  <td>{p.name}</td>
                  <td>{Number(p.unitCost).toFixed(2)}</td>
                  <td>
                    <Link href={`/products/${p.sku}`}>View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}

function ValuationSummary() {
  const [report, setReport] = useState<ValuationReport | null>(null);

  useEffect(() => {
    api.valuationReport().then(setReport).catch(() => setReport(null));
  }, []);

  if (!report) return null;

  return (
    <div className="stat-card">
      <span className="muted">Stock valuation</span>
      <p className="stat-value">
        {report.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
      </p>
      <p className="muted" style={{ margin: 0 }}>
        As of {new Date(report.asOf).toLocaleString()} across {report.byProduct.length} product
        {report.byProduct.length === 1 ? "" : "s"} with stock
      </p>
    </div>
  );
}

function NewProductForm({ onCreated }: { onCreated: () => void }) {
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [unitCost, setUnitCost] = useState(0);
  const [weightKg, setWeightKg] = useState<number | "">("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.createProduct({
        sku,
        name,
        description: description || undefined,
        unitCost,
        weightKg: weightKg === "" ? undefined : weightKg,
      });
      onCreated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="card" onSubmit={submit}>
      <h3 style={{ margin: 0 }}>New product</h3>
      <div className="field-row">
        <label>
          SKU
          <input required value={sku} onChange={(e) => setSku(e.target.value)} />
        </label>
        <label>
          Name
          <input required value={name} onChange={(e) => setName(e.target.value)} />
        </label>
      </div>
      <div className="field-row">
        <label>
          Description
          <input value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label>
          Weight (kg)
          <input
            type="number"
            min={0}
            step="0.01"
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value === "" ? "" : Number(e.target.value))}
          />
        </label>
      </div>
      <div className="field-row">
        <label>
          Unit cost (valuation baseline)
          <input
            required
            type="number"
            min={0}
            step="0.01"
            value={unitCost}
            onChange={(e) => setUnitCost(Number(e.target.value))}
          />
        </label>
      </div>
      {error && <p className="error">{error}</p>}
      <div>
        <button className="primary" type="submit" disabled={submitting}>
          {submitting ? "Creating…" : "Create product"}
        </button>
      </div>
    </form>
  );
}
