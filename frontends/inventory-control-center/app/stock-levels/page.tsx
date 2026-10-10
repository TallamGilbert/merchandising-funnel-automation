"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ExportMenu,
  exportUrl,
  formatDateTime,
  formatQuantity,
  Pagination,
  useLocations,
  usePagedList,
  usePolling,
} from "@mms/ui";
import { AppShell, type NavSection } from "../../components/AppShell";
import { BoxesIcon, LayersIcon } from "../../components/icons";
import { api } from "../../lib/api";

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
  const [locationFilter, setLocationFilter] = useState("");
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  const { data: directoryLocations } = useLocations();
  const list = usePagedList(api.listStockLevels, { locationCode: locationFilter }, 50);
  const levels = list.data?.items ?? null;

  useEffect(() => {
    if (list.data) setRefreshedAt(new Date());
  }, [list.data]);
  // Checkout reserves stock and ItemSold settles it — keep this screen live.
  usePolling(list.reload, 5000);

  const locationName = useMemo(() => {
    const names = new Map(directoryLocations.map((l) => [l.code, l.name]));
    return (code: string) => (names.has(code) ? `${names.get(code)} (${code})` : code);
  }, [directoryLocations]);

  const locations = useMemo(
    () =>
      [...new Set([...directoryLocations.map((l) => l.code), ...(levels ?? []).map((l) => l.locationCode)])].sort(),
    [levels, directoryLocations],
  );

  return (
    <AppShell
      brandName="Inventory"
      nav={NAV}
      title="Stock levels"
      subtitle="On hand / allocated / available across every location (FR-4.1, FR-4.3)."
      search={{ value: list.q, onChange: list.setQ, placeholder: "Search SKU or product…" }}
      actions={<ExportMenu href={(format) => exportUrl(api.stockLevelsUrl, list.params, format)} />}
    >
      {list.error && <p className="error">{list.error}</p>}

      <div className="row-between">
        <label style={{ maxWidth: 220 }}>
          Location
          <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}>
            <option value="">All locations</option>
            {locations.map((loc) => (
              <option key={loc} value={loc}>
                {locationName(loc)}
              </option>
            ))}
          </select>
        </label>
        {refreshedAt && (
          <span className="muted" style={{ fontSize: "0.8rem" }}>
            Live — refreshes every 5 seconds · last updated {formatDateTime(refreshedAt)}
          </span>
        )}
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
                <th>Product</th>
                <th>Location</th>
                <th className="num">On hand</th>
                <th className="num">Allocated</th>
                <th className="num">Available</th>
              </tr>
            </thead>
            <tbody>
              {levels.map((level) => (
                <tr key={level.id}>
                  <td>
                    <code>{level.sku}</code>
                  </td>
                  <td>{level.productName}</td>
                  <td>{locationName(level.locationCode)}</td>
                  <td className="num">{formatQuantity(level.onHand)}</td>
                  <td className="num">{formatQuantity(level.allocated)}</td>
                  <td className="num">{formatQuantity(level.available)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pagination data={list.data} onPageChange={list.setPage} />
      </div>
    </AppShell>
  );
}
