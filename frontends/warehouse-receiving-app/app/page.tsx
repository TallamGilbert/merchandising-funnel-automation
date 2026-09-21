"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppShell, type NavSection } from "../components/AppShell";
import { ClipboardListIcon, PackageIcon } from "../components/icons";
import { api, type ExpectedDelivery, type ExpectedDeliveryStatus } from "../lib/api";

const FEATURE_ENABLED = process.env.NEXT_PUBLIC_FEATURE_RECEIVING_ENABLED !== "false";

const NAV: NavSection[] = [
  {
    label: "Main menu",
    items: [
      { label: "Expected deliveries", href: "/", icon: <PackageIcon /> },
      { label: "Goods received notes", href: "/grns", icon: <ClipboardListIcon /> },
    ],
  },
];

export default function Page() {
  const [deliveries, setDeliveries] = useState<ExpectedDelivery[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<ExpectedDeliveryStatus | "">("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [receiving, setReceiving] = useState<ExpectedDelivery | null>(null);

  const load = () => {
    setError(null);
    api
      .listExpectedDeliveries(statusFilter || undefined)
      .then(setDeliveries)
      .catch((err: Error) => setError(err.message));
  };

  useEffect(() => {
    if (!FEATURE_ENABLED) return;
    load();
  }, [statusFilter]);

  const visible = useMemo(() => {
    if (!deliveries) return null;
    const q = search.trim().toLowerCase();
    if (!q) return deliveries;
    return deliveries.filter(
      (d) => d.poNumber.toLowerCase().includes(q) || d.supplierName.toLowerCase().includes(q),
    );
  }, [deliveries, search]);

  if (!FEATURE_ENABLED) {
    return (
      <main className="page-body">
        <h1>Warehouse Receiving App</h1>
        <p>
          <strong>Phase 2 — Warehouse</strong> — this module is implemented, but its
          feature flag is currently off.
        </p>
        <p>
          Set <code>NEXT_PUBLIC_FEATURE_RECEIVING_ENABLED=true</code> to view it.
        </p>
      </main>
    );
  }

  return (
    <AppShell
      brandName="Receiving"
      nav={NAV}
      statusCard={{
        title: "Phase 2 — Warehouse",
        description: "Validates inbound goods against approved POs and produces GRNs (FR-3.x). API docs available.",
        href: (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3004") + "/docs",
        linkLabel: "View API docs ↗",
      }}
      title="Expected deliveries"
      subtitle="Approved purchase orders the dock should expect. Start receiving when a truck arrives."
      search={{ value: search, onChange: setSearch, placeholder: "Search PO or supplier…" }}
    >
      {receiving && (
        <StartReceivingForm
          delivery={receiving}
          onCancel={() => setReceiving(null)}
        />
      )}

      {error && <p className="error">{error}</p>}

      <div className="row-between">
        <label style={{ maxWidth: 220 }}>
          Status
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ExpectedDeliveryStatus | "")}
          >
            <option value="">All</option>
            <option value="EXPECTED">Expected</option>
            <option value="PARTIALLY_RECEIVED">Partially received</option>
            <option value="RECEIVED">Received</option>
          </select>
        </label>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {visible === null ? (
          <p className="muted" style={{ padding: "1.4rem" }}>
            Loading expected deliveries…
          </p>
        ) : visible.length === 0 ? (
          <p className="muted" style={{ padding: "1.4rem" }}>
            No expected deliveries found.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>PO number</th>
                <th>Supplier</th>
                <th>Status</th>
                <th>Units outstanding</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((d) => {
                const outstanding = d.lines.reduce(
                  (sum, l) => sum + Math.max(l.quantityOrdered - l.quantityReceived, 0),
                  0,
                );
                return (
                  <tr key={d.id}>
                    <td>{d.poNumber}</td>
                    <td>{d.supplierName}</td>
                    <td>
                      <span className={`badge${d.status === "RECEIVED" ? " ok" : ""}`}>
                        {d.status.replaceAll("_", " ")}
                      </span>
                    </td>
                    <td>{outstanding}</td>
                    <td>
                      {d.status !== "RECEIVED" && (
                        <button className="primary" onClick={() => setReceiving(d)}>
                          Receive
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}

function StartReceivingForm({
  delivery,
  onCancel,
}: {
  delivery: ExpectedDelivery;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [receivedAtLocation, setReceivedAtLocation] = useState("WH-MAIN");
  const [receivedById, setReceivedById] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const grn = await api.createGrn({
        poNumber: delivery.poNumber,
        receivedAtLocation,
        receivedById,
      });
      router.push(`/grns/${grn.id}`);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  };

  return (
    <form className="card" onSubmit={submit}>
      <h3 style={{ margin: 0 }}>Receive {delivery.poNumber}</h3>
      <p className="muted" style={{ margin: 0 }}>
        {delivery.supplierName} — opens a draft GRN. Procurement is checked to confirm the PO is
        still open and approved.
      </p>

      <div className="field-row">
        <label>
          Dock location code
          <input
            required
            value={receivedAtLocation}
            onChange={(e) => setReceivedAtLocation(e.target.value)}
            placeholder="e.g. WH-MAIN"
          />
        </label>
        <label>
          Received by (user id)
          <input
            required
            value={receivedById}
            onChange={(e) => setReceivedById(e.target.value)}
            placeholder="e.g. dock-james"
          />
        </label>
      </div>

      {error && <p className="error">{error}</p>}
      <div className="actions">
        <button className="primary" type="submit" disabled={submitting}>
          {submitting ? "Opening…" : "Start receiving"}
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
