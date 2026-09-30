"use client";

import { BarChart, ChartCard, formatDateTime, formatQuantity, useLocations } from "@mms/ui";
import { AppShell } from "../../components/AppShell";
import { Kpi, OpenApp, Show } from "../../components/Panels";
import { NAV, STATUS_CARD } from "../../lib/nav";
import { APP_URL, services } from "../../lib/services";
import { useLive } from "../../lib/useLive";

const DAY_MS = 24 * 60 * 60 * 1000;

export default function WarehousePage() {
  const { data: locations } = useLocations();
  const locationName = (code: string) => locations.find((l) => l.code === code)?.name ?? code;
  const deliveries = useLive(() => services.expectedDeliveries(), []);
  const receipts = useLive(() => services.goodsReceivedNotes(), []);
  const putaways = useLive(() => services.pendingPutaways(), []);
  const transfers = useLive(() => services.transfersPicking(), []);
  const utilization = useLive(() => services.utilization(), []);

  return (
    <AppShell
      brandName="Executive"
      nav={NAV}
      statusCard={STATUS_CARD}
      title="Warehouse"
      subtitle="Goods on their way in, what's been received, work waiting on the floor, and how full the warehouse is."
      actions={
        <>
          <OpenApp href={APP_URL.receiving} label="Receiving" />
          <OpenApp href={APP_URL.warehouse} label="Warehouse Floor" />
        </>
      }
    >
      <div className="mms-chart-grid">
        <Show live={deliveries} what="Expected deliveries">
          {(d) => {
            const open = d.filter((x) => x.status !== "RECEIVED");
            const units = open.reduce((s, x) => s + x.lines.reduce((u, l) => u + Math.max(l.quantityOrdered - l.quantityReceived, 0), 0), 0);
            return <Kpi label="Deliveries expected" value={formatQuantity(open.length)} note={`${formatQuantity(units)} units still to arrive`} />;
          }}
        </Show>
        <Show live={receipts} what="Goods received">
          {(r) => {
            const recent = r.filter((g) => g.status === "FINALIZED" && g.finalizedAt && Date.now() - new Date(g.finalizedAt).getTime() < 30 * DAY_MS);
            const flagged = recent.filter((g) => g.lines.some((l) => l.discrepancyType !== "NONE"));
            return (
              <Kpi
                label="Received in the last 30 days"
                value={`${recent.length} deliveries`}
                note={flagged.length ? `${flagged.length} with a shortage, overage or damage` : "All matched their orders"}
                tone={flagged.length ? "warn" : undefined}
              />
            );
          }}
        </Show>
        <Show live={putaways} what="Putaway tasks">
          {(p) => <Kpi label="Waiting to be put away" value={formatQuantity(p.length)} note={`${formatQuantity(p.reduce((s, t) => s + t.quantity, 0))} units on the dock`} tone={p.length ? "warn" : undefined} />}
        </Show>
        <Show live={transfers} what="Transfers">
          {(t) => <Kpi label="Transfers being picked" value={formatQuantity(t.length)} note={`${formatQuantity(t.reduce((s, x) => s + x.quantity, 0))} units in transit to stores`} />}
        </Show>
      </div>

      <Show live={utilization} what="Warehouse space">
        {(zones) => (
          <ChartCard
            title="How full each zone is"
            subtitle="Share of volume capacity in use"
            empty={zones.length === 0 ? "No bins set up yet." : false}
            table={{
              columns: ["Zone", "Volume used", "Weight used", "Bins"],
              rows: zones.map((z) => [`${locationName(z.locationCode)} · ${z.zone}`, `${z.volumeUtilizationPct}%`, `${z.weightUtilizationPct}%`, z.binCount]),
            }}
          >
            <BarChart
              max={100}
              data={zones.map((z) => ({
                label: `${locationName(z.locationCode)} · ${z.zone}`,
                value: z.volumeUtilizationPct,
                detail: `weight ${z.weightUtilizationPct}% · ${z.binCount} bins`,
              }))}
              format={(v) => `${v}%`}
            />
          </ChartCard>
        )}
      </Show>

      <Show live={deliveries} what="Expected deliveries">
        {(d) => {
          const open = d.filter((x) => x.status !== "RECEIVED");
          return (
            open.length > 0 && (
              <div className="card" style={{ padding: 0 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Expected delivery</th>
                      <th>Supplier</th>
                      <th>Ordered</th>
                      <th className="num">Units to arrive</th>
                    </tr>
                  </thead>
                  <tbody>
                    {open.map((x) => (
                      <tr key={x.id}>
                        <td>{x.poNumber}</td>
                        <td>{x.supplierName}</td>
                        <td>{formatDateTime(x.createdAt)}</td>
                        <td className="num">
                          {formatQuantity(x.lines.reduce((u, l) => u + Math.max(l.quantityOrdered - l.quantityReceived, 0), 0))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          );
        }}
      </Show>
    </AppShell>
  );
}
