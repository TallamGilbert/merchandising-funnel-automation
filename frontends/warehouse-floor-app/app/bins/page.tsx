"use client";

import { useEffect, useState } from "react";
import { AppShell, type NavSection } from "../../components/AppShell";
import { BoxesIcon, LayersIcon, PackageIcon } from "../../components/icons";
import { api, type Bin, type ZoneUtilization } from "../../lib/api";

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

const CM3_PER_M3 = 1_000_000;

export default function BinsPage() {
  const [bins, setBins] = useState<Bin[] | null>(null);
  const [zones, setZones] = useState<ZoneUtilization[] | null>(null);
  const [locationFilter, setLocationFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = () => {
    setError(null);
    const location = locationFilter.trim() || undefined;
    Promise.all([api.listBins(location), api.getUtilization(location)])
      .then(([binList, utilization]) => {
        setBins(binList);
        setZones(utilization);
      })
      .catch((err: Error) => setError(err.message));
  };

  useEffect(load, [locationFilter]);

  return (
    <AppShell
      brandName="Warehouse"
      nav={NAV}
      title="Bins & capacity"
      subtitle="Space and weight capacity by zone (FR-5.5). Capacity is reserved as soon as a putaway is directed to a bin."
      actions={
        <button className="primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "New bin"}
        </button>
      }
    >
      {showForm && (
        <NewBinForm
          onCreated={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      {error && <p className="error">{error}</p>}

      <div className="row-between">
        <label style={{ maxWidth: 220 }}>
          Location code
          <input
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            placeholder="All locations"
          />
        </label>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "1rem" }}>
        {zones === null ? (
          <p className="muted">Loading utilization…</p>
        ) : zones.length === 0 ? (
          <p className="muted">No bins defined yet.</p>
        ) : (
          zones.map((z) => (
            <div className="stat-card" key={`${z.locationCode}-${z.zone}`}>
              <span className="muted">
                {z.locationCode} · {z.zone}
              </span>
              <p className="stat-value">{z.volumeUtilizationPct}%</p>
              <p className="muted" style={{ margin: 0 }}>
                {(z.usedVolumeCm3 / CM3_PER_M3).toFixed(2)} of{" "}
                {(z.capacityVolumeCm3 / CM3_PER_M3).toFixed(2)} m³ across {z.binCount} bin
                {z.binCount === 1 ? "" : "s"} · weight {z.weightUtilizationPct}%
              </p>
            </div>
          ))
        )}
      </div>

      <div className="card" style={{ padding: 0 }}>
        {bins === null ? (
          <p className="muted" style={{ padding: "1.4rem" }}>
            Loading bins…
          </p>
        ) : bins.length === 0 ? (
          <p className="muted" style={{ padding: "1.4rem" }}>
            No bins found.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Bin</th>
                <th>Location</th>
                <th>Zone</th>
                <th>Volume used</th>
                <th>Weight used</th>
                <th>Contents</th>
              </tr>
            </thead>
            <tbody>
              {bins.map((bin) => {
                const contents = (bin.stock ?? []).filter((s) => s.quantity > 0);
                return (
                  <tr key={bin.id}>
                    <td>
                      <code>{bin.code}</code>
                    </td>
                    <td>{bin.locationCode}</td>
                    <td>{bin.zone}</td>
                    <td>
                      {(Number(bin.usedVolumeCm3) / CM3_PER_M3).toFixed(2)} /{" "}
                      {(Number(bin.capacityVolumeCm3) / CM3_PER_M3).toFixed(2)} m³
                    </td>
                    <td>
                      {Number(bin.usedWeightKg).toFixed(0)} / {Number(bin.maxWeightKg).toFixed(0)} kg
                    </td>
                    <td>
                      {contents.length === 0 ? (
                        <span className="muted">Empty</span>
                      ) : (
                        contents.map((s) => `${s.quantity} × ${s.sku}`).join(", ")
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

function NewBinForm({ onCreated }: { onCreated: () => void }) {
  const [code, setCode] = useState("");
  const [locationCode, setLocationCode] = useState("WH-MAIN");
  const [zone, setZone] = useState("");
  const [pickPriority, setPickPriority] = useState(100);
  const [capacityM3, setCapacityM3] = useState(1);
  const [maxWeightKg, setMaxWeightKg] = useState(500);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.createBin({
        code,
        locationCode,
        zone,
        pickPriority,
        capacityVolumeCm3: Math.round(capacityM3 * CM3_PER_M3),
        maxWeightKg,
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
      <h3 style={{ margin: 0 }}>New bin</h3>

      <div className="field-row">
        <label>
          Bin code
          <input required value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. A-01-03" />
        </label>
        <label>
          Location code
          <input required value={locationCode} onChange={(e) => setLocationCode(e.target.value)} />
        </label>
        <label>
          Zone
          <input required value={zone} onChange={(e) => setZone(e.target.value)} placeholder="e.g. FAST-PICK" />
        </label>
      </div>
      <div className="field-row">
        <label>
          Pick priority (lower = nearer dispatch)
          <input type="number" value={pickPriority} onChange={(e) => setPickPriority(Number(e.target.value))} />
        </label>
        <label>
          Capacity (m³)
          <input
            required
            type="number"
            min={0}
            step="0.01"
            value={capacityM3}
            onChange={(e) => setCapacityM3(Number(e.target.value))}
          />
        </label>
        <label>
          Max weight (kg)
          <input
            required
            type="number"
            min={0}
            value={maxWeightKg}
            onChange={(e) => setMaxWeightKg(Number(e.target.value))}
          />
        </label>
      </div>

      {error && <p className="error">{error}</p>}
      <div>
        <button className="primary" type="submit" disabled={submitting}>
          {submitting ? "Creating…" : "Create bin"}
        </button>
      </div>
    </form>
  );
}
