"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { formatDateTime, StaffPicker, useFlash, useLocations, useStaffNames } from "@mms/ui";
import { AppShell, type NavSection } from "../../../components/AppShell";
import { BoxesIcon, LayersIcon, PackageIcon } from "../../../components/icons";
import { api, type PickTask, type Transfer } from "../../../lib/api";
import { useOperator } from "../../../lib/operator";

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
  const [operator, setOperator] = useOperator();
  const nameOf = useStaffNames();
  const { data: locations } = useLocations();
  const locationName = (code: string) => locations.find((l) => l.code === code)?.name ?? code;

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
            {locationName(transfer.fromLocationCode)} → {locationName(transfer.toLocationCode)}
          </dd>
          <dt className="muted">Requested by</dt>
          <dd style={{ margin: 0 }}>{nameOf(transfer.requestedById)}</dd>
          <dt className="muted">Requested</dt>
          <dd style={{ margin: 0 }}>{formatDateTime(transfer.createdAt)}</dd>
          {transfer.completedAt && (
            <>
              <dt className="muted">Completed</dt>
              <dd style={{ margin: 0 }}>{formatDateTime(transfer.completedAt)}</dd>
            </>
          )}
        </dl>
      </div>

      <section>
        <h2>Picks{transfer.status === "PICKING" ? ` — ${remaining} to go` : ""}</h2>
        {transfer.status === "PICKING" && (
          <label style={{ maxWidth: 360, marginBottom: "1rem" }}>
            Picking as
            <StaffPicker roles={["WAREHOUSE_STAFF", "MANAGER"]} value={operator} onChange={setOperator} />
          </label>
        )}
        {transfer.picks.map((pick) => (
          <PickCard key={pick.id} pick={pick} operator={operator} pickedByName={nameOf(pick.pickedById)} onChanged={load} />
        ))}
      </section>
    </AppShell>
  );
}

function PickCard({
  pick,
  operator,
  pickedByName,
  onChanged,
}: {
  pick: PickTask;
  operator: string;
  pickedByName: string;
  onChanged: () => void;
}) {
  const flash = useFlash();
  const [scannedBinCode, setScannedBinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.completePick(pick.id, { pickedById: operator, scannedBinCode });
      flash.success(`Picked ${pick.quantity} × ${pick.sku} from ${pick.bin.code}`);
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
          Picked by {pickedByName}
          {pick.pickedAt ? ` on ${formatDateTime(pick.pickedAt)}` : ""}.
        </p>
      ) : (
        <form onSubmit={submit}>
          <div className="field-row">
            <label>
              Confirm bin — scan its label or pick it
              <input
                required
                value={scannedBinCode}
                onChange={(e) => setScannedBinCode(e.target.value)}
                placeholder={`Scan ${pick.bin.code}`}
                style={{ fontSize: "1.1rem", padding: "0.75rem 0.9rem" }}
                autoComplete="off"
                list={`pick-bin-${pick.id}`}
              />
              <datalist id={`pick-bin-${pick.id}`}>
                <option value={pick.bin.code}>{`Zone ${pick.bin.zone}`}</option>
              </datalist>
            </label>
          </div>
          {error && <p className="error">{error}</p>}
          {!operator && <p className="muted" style={{ margin: 0 }}>Choose who is picking above to confirm.</p>}
          <div>
            <button
              className="primary"
              type="submit"
              disabled={busy || !operator}
              style={{ padding: "0.75rem 1.5rem" }}
            >
              {busy ? "Confirming…" : "Confirm pick"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
