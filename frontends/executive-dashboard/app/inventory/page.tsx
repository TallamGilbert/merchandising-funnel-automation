"use client";

import { BarChart, ChartCard, formatDateTime, formatMoney, formatQuantity, useLocations } from "@mms/ui";
import { AppShell } from "../../components/AppShell";
import { Kpi, OpenApp, Show } from "../../components/Panels";
import { NAV, STATUS_CARD } from "../../lib/nav";
import { APP_URL, services } from "../../lib/services";
import { useLive } from "../../lib/useLive";

const TOP = 8;

export default function InventoryPage() {
  const { data: locations } = useLocations();
  const locationName = (code: string) => locations.find((l) => l.code === code)?.name ?? code;
  const valuation = useLive(() => services.valuation(), []);
  const levels = useLive(() => services.stockLevels(), []);
  const reorders = useLive(() => services.reorderSuggestions(), []);

  return (
    <AppShell
      brandName="Executive"
      nav={NAV}
      statusCard={STATUS_CARD}
      title="Inventory"
      subtitle="What stock the business holds, where it is, and what's running low."
      actions={<OpenApp href={APP_URL.inventory} label="Inventory Control Center" />}
    >
      <div className="mms-chart-grid">
        <Show live={valuation} what="Stock valuation">
          {(v) => (
            <Kpi label="Stock value" value={formatMoney(v.totalValue)} note={`At cost, as of ${formatDateTime(v.asOf)}`} />
          )}
        </Show>
        <Show live={levels} what="Stock levels">
          {(l) => (
            <Kpi
              label="Units on hand"
              value={formatQuantity(l.reduce((s, x) => s + x.onHand, 0))}
              note={`${formatQuantity(l.reduce((s, x) => s + x.available, 0))} available to sell or move`}
            />
          )}
        </Show>
        <Show live={reorders} what="Reorder suggestions">
          {(r) => <Kpi label="Running low" value={`${r.length} product${r.length === 1 ? "" : "s"}`} tone={r.length ? "warn" : undefined} note="Suggested for reorder" />}
        </Show>
      </div>

      <div className="mms-chart-grid">
        <Show live={valuation} what="Stock valuation">
          {(v) => {
            const sorted = [...v.byProduct].sort((a, b) => b.totalValue - a.totalValue);
            const rest = sorted.slice(TOP).reduce((s, p) => s + p.totalValue, 0);
            return (
              <ChartCard
                title="Where the money is tied up"
                subtitle={`Stock value by product, top ${Math.min(TOP, sorted.length)} of ${sorted.length}`}
                empty={sorted.length === 0 ? "No stock on hand." : false}
                table={{ columns: ["Product", "On hand", "Value"], rows: sorted.map((p) => [p.productName, formatQuantity(p.onHand), formatMoney(p.totalValue)]) }}
              >
                <BarChart
                  data={[
                    ...sorted.slice(0, TOP).map((p) => ({ label: p.productName, value: p.totalValue, detail: `${formatQuantity(p.onHand)} on hand` })),
                    ...(rest > 0 ? [{ label: `Other ${sorted.length - TOP}`, value: rest }] : []),
                  ]}
                  format={(n) => formatMoney(n)}
                />
              </ChartCard>
            );
          }}
        </Show>
        <Show live={levels} what="Stock levels">
          {(l) => {
            const byLocation = new Map<string, number>();
            for (const x of l) byLocation.set(x.locationCode, (byLocation.get(x.locationCode) ?? 0) + x.onHand);
            const rows = [...byLocation.entries()].sort((a, b) => b[1] - a[1]);
            return (
              <ChartCard
                title="Units by location"
                empty={rows.length === 0 ? "No stock recorded." : false}
                table={{ columns: ["Location", "Units on hand"], rows: rows.map(([code, n]) => [locationName(code), formatQuantity(n)]) }}
              >
                <BarChart data={rows.map(([code, n]) => ({ label: locationName(code), value: n, detail: code }))} format={(n) => `${formatQuantity(n)} units`} />
              </ChartCard>
            );
          }}
        </Show>
      </div>

      <Show live={reorders} what="Reorder suggestions">
        {(r) =>
          r.length > 0 && (
            <div className="card" style={{ padding: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>Running low</th>
                    <th>Why</th>
                    <th>Flagged</th>
                  </tr>
                </thead>
                <tbody>
                  {r.map((s) => (
                    <tr key={s.id}>
                      <td><code>{s.sku}</code></td>
                      <td className="muted">{s.reason}</td>
                      <td>{formatDateTime(s.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </Show>
    </AppShell>
  );
}
