"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import {
  CurrencySelect,
  DEFAULT_CURRENCY,
  formatDate,
  formatMoney,
  Modal,
  ProductPicker,
  PurchaseOrderPicker,
  useFlash,
} from "@mms/ui";
import { AppShell, type NavSection } from "../../../components/AppShell";
import { PackageIcon } from "../../../components/icons";
import {
  api,
  type SupplierDeliveryRecord,
  type SupplierDetail,
  type SupplierProduct,
} from "../../../lib/api";

const NAV: NavSection[] = [
  {
    label: "Main menu",
    items: [{ label: "Suppliers", href: "/", icon: <PackageIcon /> }],
  },
];

export default function SupplierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [supplier, setSupplier] = useState<SupplierDetail | null>(null);
  const [records, setRecords] = useState<SupplierDeliveryRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const flash = useFlash();

  const load = () => {
    setError(null);
    Promise.all([api.getSupplier(id), api.listDeliveryRecords(id)])
      .then(([s, r]) => {
        setSupplier(s);
        setRecords(r);
      })
      .catch((err: Error) => setError(err.message));
  };

  useEffect(load, [id]);

  if (error) {
    return (
      <AppShell brandName="Vendor Mgmt" nav={NAV} title="Supplier not found">
        <p className="error">{error}</p>
        <Link href="/">&larr; Back to suppliers</Link>
      </AppShell>
    );
  }

  if (!supplier) {
    return (
      <AppShell brandName="Vendor Mgmt" nav={NAV} title="Loading…">
        <p className="muted">Loading…</p>
      </AppShell>
    );
  }

  const archive = async () => {
    if (!confirm(`Archive ${supplier.name}? This cannot be undone from here.`)) return;
    try {
      await api.archiveSupplier(id);
      flash.success(`${supplier.name} archived`);
      load();
    } catch (err) {
      flash.error((err as Error).message);
    }
  };

  return (
    <AppShell
      brandName="Vendor Mgmt"
      nav={NAV}
      title={supplier.name}
      actions={
        <>
          <button onClick={() => setEditing((v) => !v)}>
            {editing ? "Cancel" : "Edit"}
          </button>
          {supplier.status === "ACTIVE" && (
            <button className="danger" onClick={archive}>
              Archive
            </button>
          )}
        </>
      }
    >
      <Link href="/">&larr; Back to suppliers</Link>

      <div className="row-between" style={{ marginTop: "-0.5rem" }}>
        <span className={`badge ${supplier.status === "ACTIVE" ? "ok" : ""}`}>
          {supplier.status}
        </span>
      </div>

      {editing ? (
        <EditSupplierForm
          supplier={supplier}
          onSaved={() => {
            setEditing(false);
            flash.success("Supplier details saved");
            load();
          }}
        />
      ) : (
        <div className="card">
          <dl style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: "0.5rem 1rem", margin: 0 }}>
            <dt className="muted">Email</dt>
            <dd style={{ margin: 0 }}>{supplier.email}</dd>
            <dt className="muted">Contact</dt>
            <dd style={{ margin: 0 }}>{supplier.contactName ?? "—"}</dd>
            <dt className="muted">Phone</dt>
            <dd style={{ margin: 0 }}>{supplier.phone ?? "—"}</dd>
            <dt className="muted">Address</dt>
            <dd style={{ margin: 0 }}>{supplier.address ?? "—"}</dd>
            <dt className="muted">Payment terms</dt>
            <dd style={{ margin: 0 }}>Net {supplier.paymentTermsDays}</dd>
            <dt className="muted">On-time delivery rate</dt>
            <dd style={{ margin: 0 }}>
              {supplier.onTimeDeliveryRate === null
                ? "No delivery history yet"
                : `${Math.round(supplier.onTimeDeliveryRate * 100)}%`}
            </dd>
          </dl>
        </div>
      )}

      <section>
        <h2>Products</h2>
        <ProductsSection supplierId={id} products={supplier.products} onChange={load} />
      </section>

      <section>
        <h2>Delivery records</h2>
        <DeliveryRecordsSection
          supplierId={id}
          records={records ?? []}
          onChange={load}
        />
      </section>
    </AppShell>
  );
}

function EditSupplierForm({
  supplier,
  onSaved,
}: {
  supplier: SupplierDetail;
  onSaved: () => void;
}) {
  const [name, setName] = useState(supplier.name);
  const [email, setEmail] = useState(supplier.email);
  const [contactName, setContactName] = useState(supplier.contactName ?? "");
  const [phone, setPhone] = useState(supplier.phone ?? "");
  const [address, setAddress] = useState(supplier.address ?? "");
  const [paymentTermsDays, setPaymentTermsDays] = useState(supplier.paymentTermsDays);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.updateSupplier(supplier.id, {
        name,
        email,
        contactName,
        phone,
        address,
        paymentTermsDays,
      });
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
          Email
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
      </div>
      <div className="field-row">
        <label>
          Contact name
          <input value={contactName} onChange={(e) => setContactName(e.target.value)} />
        </label>
        <label>
          Phone
          <input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
      </div>
      <div className="field-row">
        <label>
          Address
          <input value={address} onChange={(e) => setAddress(e.target.value)} />
        </label>
        <label>
          Payment terms (days)
          <input
            required
            type="number"
            min={0}
            value={paymentTermsDays}
            onChange={(e) => setPaymentTermsDays(Number(e.target.value))}
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

function ProductsSection({
  supplierId,
  products,
  onChange,
}: {
  supplierId: string;
  products: SupplierDetail["products"];
  onChange: () => void;
}) {
  const flash = useFlash();
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<SupplierProduct | null>(null);
  const [sku, setSku] = useState("");
  const [productName, setProductName] = useState("");
  const [unitCost, setUnitCost] = useState(0);
  const [currency, setCurrency] = useState<string>(DEFAULT_CURRENCY);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.addProduct(supplierId, { sku, productName, unitCost, currency });
      flash.success(`${productName} added to this supplier's catalog`);
      setSku("");
      setProductName("");
      setUnitCost(0);
      setCurrency(DEFAULT_CURRENCY);
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
      {products.length === 0 ? (
        <p className="muted">No products yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Product</th>
              <th className="num">Unit cost</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td>
                  <code>{p.sku}</code>
                </td>
                <td>{p.productName}</td>
                <td className="num">{formatMoney(p.unitCost, p.currency)}</td>
                <td style={{ textAlign: "right" }}>
                  <button onClick={() => setEditingProduct(p)}>Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editingProduct && (
        <EditProductModal
          supplierId={supplierId}
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSaved={(name) => {
            setEditingProduct(null);
            flash.success(`${name} updated`);
            onChange();
          }}
        />
      )}

      {showForm ? (
        <form className="card" onSubmit={submit}>
          <div className="field-row">
            <label>
              Product
              <ProductPicker
                required
                value={sku}
                excludeSkus={products.map((p) => p.sku)}
                onChange={setSku}
                onSelectProduct={(product) => setProductName(product?.name ?? "")}
              />
            </label>
            <label>
              Name on this supplier's catalog
              <input
                required
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
              />
            </label>
          </div>
          <div className="field-row">
            <label>
              Unit cost
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
              Currency
              <CurrencySelect value={currency} onChange={setCurrency} />
            </label>
          </div>
          {error && <p className="error">{error}</p>}
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button className="primary" type="submit" disabled={submitting}>
              {submitting ? "Adding…" : "Add product"}
            </button>
            <button type="button" onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div>
          <button onClick={() => setShowForm(true)}>Add product</button>
        </div>
      )}
    </div>
  );
}

function EditProductModal({
  supplierId,
  product,
  onClose,
  onSaved,
}: {
  supplierId: string;
  product: SupplierProduct;
  onClose: () => void;
  onSaved: (productName: string) => void;
}) {
  const [productName, setProductName] = useState(product.productName);
  const [unitCost, setUnitCost] = useState(Number(product.unitCost));
  const [currency, setCurrency] = useState(product.currency);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.updateProduct(supplierId, product.id, { productName, unitCost, currency });
      onSaved(productName);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open title={`Edit ${product.sku}`} onClose={onClose}>
      <form onSubmit={submit}>
        <label>
          Product name
          <input required value={productName} onChange={(e) => setProductName(e.target.value)} />
        </label>
        <div className="field-row">
          <label>
            Unit cost
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
            Currency
            <CurrencySelect value={currency} onChange={setCurrency} />
          </label>
        </div>
        {error && <p className="error">{error}</p>}
        <div className="mms-modal-footer">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function DeliveryRecordsSection({
  supplierId,
  records,
  onChange,
}: {
  supplierId: string;
  records: SupplierDeliveryRecord[];
  onChange: () => void;
}) {
  const flash = useFlash();
  const [showForm, setShowForm] = useState(false);
  const [poReference, setPoReference] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [actualDeliveryDate, setActualDeliveryDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.addDeliveryRecord(supplierId, {
        poReference,
        expectedDate,
        actualDeliveryDate,
      });
      flash.success(`Delivery record for ${poReference} added`);
      setPoReference("");
      setExpectedDate("");
      setActualDeliveryDate("");
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
      {records.length === 0 ? (
        <p className="muted">No delivery records yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>PO reference</th>
              <th>Expected</th>
              <th>Delivered</th>
              <th>On time</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id}>
                <td>{r.poReference}</td>
                <td>{formatDate(r.expectedDate.slice(0, 10))}</td>
                <td>{formatDate(r.actualDeliveryDate.slice(0, 10))}</td>
                <td>
                  <span className={`badge ${r.onTime ? "ok" : "warn"}`}>
                    {r.onTime ? "On time" : "Late"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showForm ? (
        <form className="card" onSubmit={submit}>
          <div className="field-row">
            <label>
              Purchase order
              <PurchaseOrderPicker
                required
                supplierId={supplierId}
                value={poReference}
                onChange={setPoReference}
              />
            </label>
          </div>
          <div className="field-row">
            <label>
              Expected date
              <input
                required
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
              />
            </label>
            <label>
              Actual delivery date
              <input
                required
                type="date"
                value={actualDeliveryDate}
                onChange={(e) => setActualDeliveryDate(e.target.value)}
              />
            </label>
          </div>
          {error && <p className="error">{error}</p>}
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button className="primary" type="submit" disabled={submitting}>
              {submitting ? "Adding…" : "Add record"}
            </button>
            <button type="button" onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div>
          <button onClick={() => setShowForm(true)}>Add delivery record</button>
        </div>
      )}
    </div>
  );
}
