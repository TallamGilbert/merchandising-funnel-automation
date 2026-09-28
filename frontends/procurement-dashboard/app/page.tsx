"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Combobox, formatDateTime, formatMoney, StaffPicker, useFlash } from "@mms/ui";
import { AppShell, type NavSection } from "../components/AppShell";
import { BellAlertIcon, ClipboardListIcon } from "../components/icons";
import {
  api,
  type PurchaseOrder,
  type PurchaseOrderStatus,
  type SupplierOfferedProduct,
  type SupplierSummary,
} from "../lib/api";

const FEATURE_ENABLED = process.env.NEXT_PUBLIC_FEATURE_PROCUREMENT_ENABLED !== "false";

const NAV: NavSection[] = [
  {
    label: "Main menu",
    items: [
      { label: "Purchase orders", href: "/", icon: <ClipboardListIcon /> },
      { label: "Reorder suggestions", href: "/reorder-suggestions", icon: <BellAlertIcon /> },
    ],
  },
];

export default function Page() {
  const [orders, setOrders] = useState<PurchaseOrder[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<PurchaseOrderStatus | "">("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const flash = useFlash();

  const loadOrders = () => {
    setError(null);
    api
      .listPurchaseOrders(statusFilter || undefined)
      .then(setOrders)
      .catch((err: Error) => setError(err.message));
  };

  useEffect(() => {
    if (!FEATURE_ENABLED) return;
    loadOrders();
  }, [statusFilter]);

  const visible = useMemo(() => {
    if (!orders) return null;
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(
      (po) => po.poNumber.toLowerCase().includes(q) || po.supplierName.toLowerCase().includes(q),
    );
  }, [orders, search]);

  if (!FEATURE_ENABLED) {
    return (
      <main className="page-body">
        <h1>Procurement Dashboard</h1>
        <p>
          <strong>Phase 1 — Foundation</strong> — this module is implemented, but its
          feature flag is currently off.
        </p>
        <p>
          Set <code>NEXT_PUBLIC_FEATURE_PROCUREMENT_ENABLED=true</code> to view it.
        </p>
      </main>
    );
  }

  return (
    <AppShell
      brandName="Procurement"
      nav={NAV}
      statusCard={{
        title: "Phase 1 — Foundation",
        description: "Decision/commitment engine for purchase orders (FR-2.x). API docs available.",
        href: (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002") + "/docs",
        linkLabel: "View API docs ↗",
      }}
      title="Welcome back"
      subtitle="Create purchase orders, route approvals, and view open orders."
      search={{ value: search, onChange: setSearch, placeholder: "Search purchase orders…" }}
      actions={
        <button className="primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "New purchase order"}
        </button>
      }
    >
      {showForm && (
        <NewPurchaseOrderForm
          onCreated={(poNumber) => {
            setShowForm(false);
            flash.success(`Draft ${poNumber} created`);
            loadOrders();
          }}
        />
      )}

      {error && <p className="error">{error}</p>}

      <div className="row-between">
        <label style={{ maxWidth: 220 }}>
          Status
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as PurchaseOrderStatus | "")}
          >
            <option value="">All</option>
            <option value="DRAFT">Draft</option>
            <option value="PENDING_APPROVAL">Pending approval</option>
            <option value="APPROVED">Approved</option>
            <option value="SENT">Sent</option>
            <option value="PARTIALLY_RECEIVED">Partially received</option>
            <option value="CLOSED">Closed</option>
          </select>
        </label>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {visible === null ? (
          <p className="muted" style={{ padding: "1.4rem" }}>
            Loading purchase orders…
          </p>
        ) : visible.length === 0 ? (
          <p className="muted" style={{ padding: "1.4rem" }}>
            No purchase orders found.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>PO number</th>
                <th>Supplier</th>
                <th>Status</th>
                <th>Created</th>
                <th className="num">Total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((po) => (
                <tr key={po.id}>
                  <td>{po.poNumber}</td>
                  <td>{po.supplierName}</td>
                  <td>
                    <span className="badge">{po.status.replaceAll("_", " ")}</span>
                  </td>
                  <td>{formatDateTime(po.createdAt)}</td>
                  <td className="num">{formatMoney(po.totalAmount, po.currency)}</td>
                  <td>
                    <Link href={`/purchase-orders/${po.id}`}>View</Link>
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

function NewPurchaseOrderForm({ onCreated }: { onCreated: (poNumber: string) => void }) {
  const [suppliers, setSuppliers] = useState<SupplierSummary[] | null>(null);
  const [supplierId, setSupplierId] = useState("");
  const [supplierProducts, setSupplierProducts] = useState<SupplierOfferedProduct[]>([]);
  const [requestedById, setRequestedById] = useState("");
  const [lines, setLines] = useState<{ sku: string; quantityOrdered: number }[]>([
    { sku: "", quantityOrdered: 1 },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .listActiveSuppliers()
      .then(setSuppliers)
      .catch((err: Error) => setError(`Could not load suppliers from Vendor Management: ${err.message}`));
  }, []);

  useEffect(() => {
    if (!supplierId) {
      setSupplierProducts([]);
      return;
    }
    api
      .getSupplierProducts(supplierId)
      .then(setSupplierProducts)
      .catch((err: Error) => setError(err.message));
  }, [supplierId]);

  const updateLine = (index: number, patch: Partial<{ sku: string; quantityOrdered: number }>) => {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const po = await api.createPurchaseOrder({
        supplierId,
        requestedById,
        lines: lines.filter((l) => l.sku),
      });
      onCreated(po.poNumber);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="card" onSubmit={submit}>
      <h3 style={{ margin: 0 }}>New purchase order</h3>

      <div className="field-row">
        <label>
          Supplier
          <Combobox
            required
            loading={suppliers === null}
            placeholder="Search suppliers…"
            options={(suppliers ?? []).map((s) => ({ value: s.id, label: s.name }))}
            value={supplierId}
            onChange={(value) => {
              setSupplierId(value);
              setLines([{ sku: "", quantityOrdered: 1 }]);
            }}
          />
        </label>
        <label>
          Requested by
          <StaffPicker
            required
            roles={["MANAGER", "OWNER"]}
            value={requestedById}
            onChange={setRequestedById}
          />
        </label>
      </div>

      <div>
        <p className="muted" style={{ marginBottom: "0.5rem" }}>Lines</p>
        {lines.map((line, i) => (
          <div className="field-row" key={i}>
            <label>
              SKU
              <Combobox
                required
                disabled={!supplierId}
                placeholder={supplierId ? "Search this supplier's products…" : "Choose a supplier first"}
                options={supplierProducts.map((p) => ({
                  value: p.sku,
                  label: p.productName,
                  description: `${p.sku} · ${formatMoney(p.unitCost, p.currency)}`,
                  // One line per SKU — the rest are already on this PO.
                  disabled: lines.some((l, idx) => idx !== i && l.sku === p.sku),
                }))}
                value={line.sku}
                onChange={(value) => updateLine(i, { sku: value })}
              />
            </label>
            <label style={{ maxWidth: 140 }}>
              Quantity
              <input
                required
                type="number"
                min={1}
                value={line.quantityOrdered}
                onChange={(e) => updateLine(i, { quantityOrdered: Number(e.target.value) })}
              />
            </label>
            {lines.length > 1 && (
              <button
                type="button"
                style={{ alignSelf: "flex-end" }}
                onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
              >
                Remove
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => setLines((prev) => [...prev, { sku: "", quantityOrdered: 1 }])}
          disabled={!supplierId}
        >
          Add line
        </button>
      </div>

      {error && <p className="error">{error}</p>}
      <div>
        <button className="primary" type="submit" disabled={submitting}>
          {submitting ? "Creating…" : "Create draft PO"}
        </button>
      </div>
    </form>
  );
}
