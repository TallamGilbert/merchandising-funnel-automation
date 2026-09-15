"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell, type NavSection } from "../components/AppShell";
import { PackageIcon } from "../components/icons";
import { api, type Supplier, type SupplierStatus } from "../lib/api";

const FEATURE_ENABLED =
  process.env.NEXT_PUBLIC_FEATURE_VENDOR_MANAGEMENT_ENABLED !== "false";

const NAV: NavSection[] = [
  {
    label: "Main menu",
    items: [{ label: "Suppliers", href: "/", icon: <PackageIcon /> }],
  },
];

export default function Page() {
  const [suppliers, setSuppliers] = useState<Supplier[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<SupplierStatus | "">("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = () => {
    setError(null);
    api
      .listSuppliers(statusFilter || undefined)
      .then(setSuppliers)
      .catch((err: Error) => setError(err.message));
  };

  useEffect(() => {
    if (!FEATURE_ENABLED) return;
    load();
  }, [statusFilter]);

  const visible = useMemo(() => {
    if (!suppliers) return null;
    const q = search.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(
      (s) => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q),
    );
  }, [suppliers, search]);

  if (!FEATURE_ENABLED) {
    return (
      <main className="page-body">
        <h1>Vendor Management Portal</h1>
        <p>
          <strong>Phase 1 — Foundation</strong> — this module is implemented, but its
          feature flag is currently off.
        </p>
        <p>
          Set <code>NEXT_PUBLIC_FEATURE_VENDOR_MANAGEMENT_ENABLED=true</code> to view it.
        </p>
      </main>
    );
  }

  return (
    <AppShell
      brandName="Vendor Mgmt"
      nav={NAV}
      statusCard={{
        title: "Phase 1 — Foundation",
        description: "Suppliers, terms, and product catalogs (FR-1.x). API docs available.",
        href: (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001") + "/docs",
        linkLabel: "View API docs ↗",
      }}
      title="Welcome back"
      subtitle="Browse, add, edit, and archive supplier records."
      search={{ value: search, onChange: setSearch, placeholder: "Search suppliers…" }}
      actions={
        <button className="primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "New supplier"}
        </button>
      }
    >
      {showForm && (
        <NewSupplierForm
          onCreated={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      {error && <p className="error">{error}</p>}

      <div className="row-between">
        <label style={{ maxWidth: 220 }}>
          Status
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as SupplierStatus | "")}
          >
            <option value="">All</option>
            <option value="ACTIVE">Active</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </label>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {visible === null ? (
          <p className="muted" style={{ padding: "1.4rem" }}>
            Loading suppliers…
          </p>
        ) : visible.length === 0 ? (
          <p className="muted" style={{ padding: "1.4rem" }}>
            No suppliers found.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Payment terms</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.email}</td>
                  <td>Net {s.paymentTermsDays}</td>
                  <td>
                    <span className={`badge ${s.status === "ACTIVE" ? "ok" : ""}`}>
                      {s.status}
                    </span>
                  </td>
                  <td>
                    <Link href={`/suppliers/${s.id}`}>View</Link>
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

function NewSupplierForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [paymentTermsDays, setPaymentTermsDays] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.createSupplier({
        name,
        email,
        contactName: contactName || undefined,
        phone: phone || undefined,
        address: address || undefined,
        paymentTermsDays,
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
      <h3 style={{ margin: 0 }}>New supplier</h3>
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
          {submitting ? "Creating…" : "Create supplier"}
        </button>
      </div>
    </form>
  );
}
