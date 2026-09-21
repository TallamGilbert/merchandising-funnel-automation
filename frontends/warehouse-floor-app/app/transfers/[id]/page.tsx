"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { AppShell, type NavSection } from "../../../components/AppShell";
import { BoxesIcon, LayersIcon, PackageIcon } from "../../../components/icons";
import { api, type PickTask, type Transfer } from "../../../lib/api";

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

export default function TransferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [transfer, setTransfer] = useState<Transfer | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    api.getTransfer(id).then(setTransfer).catch((err: Error) => setError(err.message));
  };

  useEffect(load, [id]);

  if (error) {
    return (
      <AppShell brandName="Warehouse" nav={NAV} title="Transfer not found">
        <p className="error">{error}</p>
        <Link href="/transfers">&larr; Back to transfers</Link>
      </AppShell>
    );
  }

  if (!transfer) {
    return (
      <AppShell brandName="Warehouse" nav={NAV} title="Loading…">
        <p className="muted">Loading…</p>
      </AppShell>
    );
  }

  const remaining = transfer.picks.filter((p) => p.status === "PENDING").length;

  return (
    <AppShell brandName="Warehouse" nav={NAV} title={transfer.transferNumber}>
      <Link href="/transfers">&larr; Back to transfers</Link>

      <div className="row-between" style={{ marginTop: "-0.5rem" }}>
        <span className={`badge${transfer.status === "COMPLETED" ? " ok" : ""}`}>{transfer.status}</span>
      </div>

      <div className="card">
        <dl style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: "0.5rem 1rem", margin: 0 }}>
          <dt className="muted">Item</dt>
          <dd style={{ margin: 0 }}>
            {transfer.quantity} × <code>{transfer.sku}</code>
          </dd>
          <dt className="muted">Route</dt>
          <dd style={{ margin: 0 }}>
            {transfer.fromLocationCode} → {transfer.toLocationCode}
          </dd>
          <dt className="muted">Requested by</dt>
          <dd style={{ margin: 0 }}>{transfer.requestedById}</dd>
          {transfer.completedAt && (
            <>
              <dt className="muted">Completed</dt>
              <dd style={{ margin: 0 }}>{new Date(transfer.completedAt).toLocaleString()}</dd>
            </>
          )}
        </dl>
      </div>

      <section>
        <h2>Picks{transfer.status === "PICKING" ? ` — ${remaining} to go` : ""}</h2>
        {transfer.picks.map((pick) => (
          <PickCard key={pick.id} pick={pick} onChanged={load} />
        ))}
      </section>
    </AppShell>
  );
}

function PickCard({ pick, onChanged }: { pick: PickTask; onChanged: () => void }) {
  const [scannedBinCode, setScannedBinCode] = useState("");
  const [pickedById, setPickedById] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.completePick(pick.id, { pickedById, scannedBinCode });
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card" style={{ marginBottom: "1rem" }}>
      <div className="row-between">
        <p style={{ margin: 0, fontSize: "1.15rem" }}>
          Pick {pick.quantity} × <code>{pick.sku}</code> from bin <strong>{pick.bin.code}</strong>{" "}
          <span className="muted">(zone {pick.bin.zone})</span>
        </p>
        <span className={`badge${pick.status === "PICKED" ? " ok" : ""}`}>{pick.status}</span>
      </div>

      {pick.status === "PICKED" ? (
        <p className="muted" style={{ margin: 0 }}>
          Picked by {pick.pickedById}
          {pick.pickedAt ? ` on ${new Date(pick.pickedAt).toLocaleString()}` : ""}.
        </p>
      ) : (
        <form onSubmit={submit}>
          <div className="field-row">
            <label>
              Scan bin code
              <input
                required
                value={scannedBinCode}
                onChange={(e) => setScannedBinCode(e.target.value)}
                placeholder={`Scan ${pick.bin.code}`}
                style={{ fontSize: "1.1rem", padding: "0.75rem 0.9rem" }}
                autoComplete="off"
              />
            </label>
            <label>
              Your user id
              <input
                required
                value={pickedById}
                onChange={(e) => setPickedById(e.target.value)}
                placeholder="e.g. picker-lucy"
                style={{ fontSize: "1.1rem", padding: "0.75rem 0.9rem" }}
              />
            </label>
          </div>
          {error && <p className="error">{error}</p>}
          <div>
            <button className="primary" type="submit" disabled={busy} style={{ padding: "0.75rem 1.5rem" }}>
              {busy ? "Confirming…" : "Confirm pick"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
