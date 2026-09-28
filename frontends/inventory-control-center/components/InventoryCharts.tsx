"use client";

import { useEffect, useState } from "react";
import { BarChart, ChartCard, formatMoney, formatQuantity, useLocations, usePolling } from "@mms/ui";
import { api, type StockLevel, type ValuationReport } from "../lib/api";

const TOP = 8;

/** Where the money and the units sit — refreshed with the rest of the page. */
export function InventoryCharts() {
  const [report, setReport] = useState<ValuationReport | null>(null);
  const [levels, setLevels] = useState<StockLevel[] | null>(null);
  const { data: locations } = useLocations();

  const load = () => {
    api.valuationReport().then(setReport).catch(() => setReport(null));
    api.listStockLevels().then(setLevels).catch(() => setLevels(null));
  };
  useEffect(load, []);
  usePolling(load, 10000);

  const byValue = [...(report?.byProduct ?? [])].sort((a, b) => b.totalValue - a.totalValue);
  const shown = byValue.slice(0, TOP);
  const rest = byValue.slice(TOP).reduce((sum, p) => sum + p.totalValue, 0);

  const byLocation = new Map<string, number>();
  for (const l of levels ?? []) byLocation.set(l.locationCode, (byLocation.get(l.locationCode) ?? 0) + l.onHand);
  const locationRows = [...byLocation.entries()]
    .map(([code, units]) => ({ code, name: locations.find((l) => l.code === code)?.name ?? code, units }))
    .sort((a, b) => b.units - a.units);

  if (!report && !levels) return null;

  return (
    <div className="mms-chart-grid">
      <ChartCard
        title="Stock value by product"
        subtitle={`Top ${Math.min(TOP, byValue.length)} of ${byValue.length} products, KES at unit cost`}
        empty={byValue.length === 0 ? "No stock on hand yet." : false}
        table={{
          columns: ["Product", "On hand", "Value"],
          rows: byValue.map((p) => [p.productName, formatQuantity(p.onHand), formatMoney(p.totalValue)]),
        }}
      >
        <BarChart
          data={[
            ...shown.map((p) => ({
              label: p.productName,
              value: p.totalValue,
              detail: `${formatQuantity(p.onHand)} on hand × ${formatMoney(p.unitCost)}`,
            })),
            ...(rest > 0 ? [{ label: `Other ${byValue.length - TOP}`, value: rest }] : []),
          ]}
          format={(v) => formatMoney(v)}
        />
      </ChartCard>

      <ChartCard
        title="Units on hand by location"
        subtitle="All products, every store and warehouse"
        empty={locationRows.length === 0 ? "No stock recorded yet." : false}
        table={{
          columns: ["Location", "Units on hand"],
          rows: locationRows.map((l) => [l.name, formatQuantity(l.units)]),
        }}
      >
        <BarChart
          data={locationRows.map((l) => ({ label: l.name, value: l.units, detail: l.code }))}
          format={(v) => `${formatQuantity(v)} units`}
        />
      </ChartCard>
    </div>
  );
}
