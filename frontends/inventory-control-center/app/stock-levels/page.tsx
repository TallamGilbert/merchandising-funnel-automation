"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell, type NavSection } from "../../components/AppShell";
import { BoxesIcon, LayersIcon } from "../../components/icons";
import { api, type StockLevel } from "../../lib/api";

const NAV: NavSection[] = [
  {
    label: "Main menu",
    items: [
      { label: "Products", href: "/", icon: <BoxesIcon /> },
      { label: "Stock levels", href: "/stock-levels", icon: <LayersIcon /> },
    ],
  },
];

export default function StockLevelsPage() {
  const [levels, setLevels] = useState<StockLevel[] | null>(null);
  const [locationFilter, setLocationFilter] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    api
      .listStockLevels(locationFilter || undefined)
      .then(setLevels)
      .catch((err: Error) => setError(err.message));
  };

  useEffect(load, [locationFilter]);

  const locations = useMemo(
    () => [...new Set((levels ?? []).map((l) => l.locationCode))].sort(),
    [levels],
  );

  return (
    <AppShell
      brandName="Inventory"
      nav={NAV}
      title="Stock levels"
      subtitle="On hand / allocated / available across every location (FR-4.1, FR-4.3)."
    >
      {error && <p className="error">{error}</p>}

      <div className="row-between">
        <label style={{ maxWidth: 220 }}>
          Location
          <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}>
            <option value="">All locations</option>
            {locations.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {levels === null ? (
          <p className="muted" style={{ padding: "1.4rem" }}>
            Loading…
          </p>
        ) : levels.length === 0 ? (
          <p className="muted" style={{ padding: "1.4rem" }}>
            No stock recorded yet.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Location</th>
                <th>On hand</th>
                <th>Allocated</th>
                <th>Available</th>
              </tr>
            </thead>
            <tbody>
              {levels.map((level) => (
                <tr key={level.id}>
                  <td>
                    <code>{level.sku}</code>
                  </td>
                  <td>{level.locationCode}</td>
                  <td>{level.onHand}</td>
                  <td>{level.allocated}</td>
                  <td>{level.available}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
