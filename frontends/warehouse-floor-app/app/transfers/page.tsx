"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  formatDateTime,
  LocationPicker,
  ProductPicker,
  StaffPicker,
  useFlash,
  useLocations,
} from "@mms/ui";
import { AppShell, type NavSection } from "../../components/AppShell";
import { BoxesIcon, LayersIcon, PackageIcon } from "../../components/icons";
import { api, type Transfer, type TransferStatus } from "../../lib/api";

const NAV: NavSection[] = [
  {
    label: "Main menu",
    items: [
      { label: "Putaway", href: "/", icon: <BoxesIcon /> },
      { label: "Transfers", href: "/transfers", icon: <PackageIcon /> },
      { label: "Bins & capacity", href: "/bins", icon: <LayersIcon /> },
    ],
  },
];

export default function TransfersPage() {
  const [transfers, setTransfers] = useState<Transfer[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<TransferStatus | "">("");
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const { data: locations } = useLocations();
  const locationName = (code: string) => locations.find((l) => l.code === code)?.name ?? code;

  useEffect(() => {
    setError(null);
    api
      .listTransfers(statusFilter || undefined)
      .then(setTransfers)
      .catch((err: Error) => setError(err.message));
  }, [statusFilter]);

  return (
    <AppShell
      brandName="Warehouse"
      nav={NAV}
      title="Transfers"
      subtitle="Move stock between locations, e.g. warehouse to showroom (FR-5.4). Pickers are directed bin by bin."
      actions={
        <button className="primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "New transfer"}
        </button>
      }
    >
      {showForm && <NewTransferForm />}

      {error && <p className="error">{error}</p>}

      <div className="row-between">
        <label style={{ maxWidth: 220 }}>
          Status
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as TransferStatus | "")}
          >
            <option value="">All</option>
            <option value="PICKING">Picking</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </label>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {transfers === null ? (
          <p className="muted" style={{ padding: "1.4rem" }}>
            Loading transfers…
          </p>
        ) : transfers.length === 0 ? (
          <p className="muted" style={{ padding: "1.4rem" }}>
            No transfers found.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Transfer</th>
                <th>Item</th>
                <th>Route</th>
                <th>Requested</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {transfers.map((t) => (
                <tr key={t.id}>
                  <td>{t.transferNumber}</td>
                  <td>
                    {t.quantity} × <code>{t.sku}</code>
                  </td>
                  <td>
                    {locationName(t.fromLocationCode)} → {locationName(t.toLocationCode)}
                  </td>
                  <td>{formatDateTime(t.createdAt)}</td>
                  <td>
                    <span className={`badge${t.status === "COMPLETED" ? " ok" : ""}`}>{t.status}</span>
                  </td>
                  <td>
                    <Link href={`/transfers/${t.id}`}>{t.status === "PICKING" ? "Pick" : "View"}</Link>
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

function NewTransferForm() {
  const router = useRouter();
  const flash = useFlash();
  const [sku, setSku] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [fromLocationCode, setFromLocationCode] = useState("");
  const [toLocationCode, setToLocationCode] = useState("");
  const [requestedById, setRequestedById] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fromLocationCode === toLocationCode) {
      setError("Choose two different locations");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const transfer = await api.createTransfer({
        sku,
        quantity,
        fromLocationCode,
        toLocationCode,
        requestedById,
      });
      flash.success(`${transfer.transferNumber} created — picks are ready`);
      router.push(`/transfers/${transfer.id}`);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  };

  return (
    <form className="card" onSubmit={submit}>
      <h3 style={{ margin: 0 }}>New transfer</h3>

      <div className="field-row">
        <label>
          Product
          <ProductPicker required value={sku} onChange={setSku} />
        </label>
        <label style={{ maxWidth: 140 }}>
          Quantity
          <input
            required
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
          />
        </label>
      </div>
      <div className="field-row">
        <label>
          From
          <LocationPicker required value={fromLocationCode} onChange={setFromLocationCode} />
        </label>
        <label>
          To
          <LocationPicker required value={toLocationCode} onChange={setToLocationCode} />
        </label>
        <label>
          Requested by
          <StaffPicker required roles={["MANAGER", "OWNER"]} value={requestedById} onChange={setRequestedById} />
        </label>
      </div>

      {error && <p className="error">{error}</p>}
      <div>
        <button className="primary" type="submit" disabled={submitting}>
          {submitting ? "Creating…" : "Create transfer"}
        </button>
      </div>
    </form>
  );
}
