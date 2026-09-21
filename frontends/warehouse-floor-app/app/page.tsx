"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell, type NavSection } from "../components/AppShell";
import { BoxesIcon, LayersIcon, PackageIcon } from "../components/icons";
import { api, type PutawayTask, type PutawayTaskStatus } from "../lib/api";

const FEATURE_ENABLED = process.env.NEXT_PUBLIC_FEATURE_WAREHOUSE_OPERATIONS_ENABLED !== "false";

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

export default function Page() {
  const [tasks, setTasks] = useState<PutawayTask[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<PutawayTaskStatus | "">("PENDING");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    api
      .listPutawayTasks(statusFilter || undefined)
      .then(setTasks)
      .catch((err: Error) => setError(err.message));
  };

  useEffect(() => {
    if (!FEATURE_ENABLED) return;
    load();
  }, [statusFilter]);

  const visible = useMemo(() => {
    if (!tasks) return null;
    const q = search.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter(
      (t) =>
        t.sku.toLowerCase().includes(q) ||
        t.productName.toLowerCase().includes(q) ||
        t.grnNumber.toLowerCase().includes(q),
    );
  }, [tasks, search]);

  if (!FEATURE_ENABLED) {
    return (
      <main className="page-body">
        <h1>Warehouse Floor App</h1>
        <p>
          <strong>Phase 2 — Warehouse</strong> — this module is implemented, but its
          feature flag is currently off.
        </p>
        <p>
          Set <code>NEXT_PUBLIC_FEATURE_WAREHOUSE_OPERATIONS_ENABLED=true</code> to view it.
        </p>
      </main>
    );
  }

  return (
    <AppShell
      brandName="Warehouse"
      nav={NAV}
      statusCard={{
        title: "Phase 2 — Warehouse",
        description: "Directs putaway, picking, and stock transfers (FR-5.x). API docs available.",
        href: (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3005") + "/docs",
        linkLabel: "View API docs ↗",
      }}
      title="Putaway"
      subtitle="Newly received stock and where to put it. Scan the bin to confirm each task."
      search={{ value: search, onChange: setSearch, placeholder: "Search SKU, product or GRN…" }}
    >
      {error && <p className="error">{error}</p>}

      <div className="row-between">
        <label style={{ maxWidth: 220 }}>
          Status
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as PutawayTaskStatus | "")}
          >
            <option value="PENDING">Pending</option>
            <option value="COMPLETED">Completed</option>
            <option value="">All</option>
          </select>
        </label>
      </div>

      {visible === null ? (
        <p className="muted">Loading putaway tasks…</p>
      ) : visible.length === 0 ? (
        <p className="muted">No putaway tasks found.</p>
      ) : (
        visible.map((task) => <PutawayCard key={task.id} task={task} onChanged={load} />)
      )}
    </AppShell>
  );
}

function PutawayCard({ task, onChanged }: { task: PutawayTask; onChanged: () => void }) {
  const [scannedBinCode, setScannedBinCode] = useState("");
  const [completedById, setCompletedById] = useState("");
  const [overrideBin, setOverrideBin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <div className="row-between">
        <div>
          <h3 style={{ margin: 0 }}>
            {task.quantity} × <code>{task.sku}</code> — {task.productName}
          </h3>
          <p className="muted" style={{ margin: "0.25rem 0 0" }}>
            {task.grnNumber} · PO {task.poNumber} · arrived at {task.locationCode}
          </p>
        </div>
        <span className={`badge${task.status === "COMPLETED" ? " ok" : ""}`}>{task.status}</span>
      </div>

      {task.status === "COMPLETED" ? (
        <p className="muted" style={{ margin: 0 }}>
          Put away in <strong>{task.bin?.code}</strong> by {task.completedById}
          {task.completedAt ? ` on ${new Date(task.completedAt).toLocaleString()}` : ""}.
        </p>
      ) : task.bin ? (
        <>
          <p style={{ margin: 0, fontSize: "1.15rem" }}>
            Take to bin <strong>{task.bin.code}</strong>{" "}
            <span className="muted">(zone {task.bin.zone})</span>
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => api.completePutaway(task.id, { completedById, scannedBinCode }));
            }}
          >
            <div className="field-row">
              <label>
                Scan bin code
                <input
                  required
                  value={scannedBinCode}
                  onChange={(e) => setScannedBinCode(e.target.value)}
                  placeholder={`Scan ${task.bin.code}`}
                  style={{ fontSize: "1.1rem", padding: "0.75rem 0.9rem" }}
                  autoComplete="off"
                />
              </label>
              <label>
                Your user id
                <input
                  required
                  value={completedById}
                  onChange={(e) => setCompletedById(e.target.value)}
                  placeholder="e.g. fork-amos"
                  style={{ fontSize: "1.1rem", padding: "0.75rem 0.9rem" }}
                />
              </label>
            </div>
            <div>
              <button className="primary" type="submit" disabled={busy} style={{ padding: "0.75rem 1.5rem" }}>
                {busy ? "Confirming…" : "Confirm putaway"}
              </button>
            </div>
          </form>
        </>
      ) : (
        <>
          <p className="muted" style={{ margin: 0 }}>
            No bin assigned yet — nothing had room, or item details were unavailable when this
            arrived.
          </p>
          <div className="field-row">
            <label>
              Specific bin (optional — leave empty to auto-select)
              <input
                value={overrideBin}
                onChange={(e) => setOverrideBin(e.target.value)}
                placeholder="e.g. A-01-03"
              />
            </label>
          </div>
          <div>
            <button
              className="primary"
              disabled={busy}
              onClick={() => run(() => api.assignBin(task.id, overrideBin.trim() || undefined))}
            >
              {overrideBin.trim() ? "Assign this bin" : "Find a bin"}
            </button>
          </div>
        </>
      )}

      {error && <p className="error">{error}</p>}
    </div>
  );
}
