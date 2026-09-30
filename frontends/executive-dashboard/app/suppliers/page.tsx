"use client";

import { BarChart, ChartCard, formatMoney } from "@mms/ui";
import { AppShell } from "../../components/AppShell";
import { Kpi, OpenApp, Show } from "../../components/Panels";
import { NAV, STATUS_CARD } from "../../lib/nav";
import { APP_URL, services } from "../../lib/services";
import { settled, useLive } from "../../lib/useLive";

// Reliability needs each supplier's own record; cap the fan-out.
const MAX_SUPPLIERS = 30;

export default function SuppliersPage() {
  const suppliers = useLive(async () => {
    const active = await services.suppliers();
    const details = await settled(active.slice(0, MAX_SUPPLIERS), (s) => services.supplier(s.id));
    return { active, details: details.map((d) => d.value) };
  }, []);
  const orders = useLive(() => services.purchaseOrders(), []);

  return (
    <AppShell
      brandName="Executive"
      nav={NAV}
      statusCard={STATUS_CARD}
      title="Suppliers"
      subtitle="Who the business buys from, how reliably they deliver, and how much goes to each."
      actions={<OpenApp href={APP_URL.vendorManagement} label="Vendor Management Portal" />}
    >
      <Show live={suppliers} what="Suppliers">
        {({ active, details }) => {
          const rated = details.filter((d) => d.onTimeDeliveryRate !== null);
          const average = rated.length ? rated.reduce((s, d) => s + (d.onTimeDeliveryRate ?? 0), 0) / rated.length : null;
          const late = rated.filter((d) => (d.onTimeDeliveryRate ?? 1) < 0.8);
          return (
            <>
              <div className="mms-chart-grid">
                <Kpi label="Active suppliers" value={active.length} note={`${details.reduce((s, d) => s + d.products.length, 0)} products offered`} />
                <Kpi
                  label="On-time delivery"
                  value={average === null ? "—" : `${Math.round(average * 100)}%`}
                  note={average === null ? "No deliveries recorded yet" : `Average across ${rated.length} supplier(s) with history`}
                />
                <Kpi
                  label="Often late"
                  value={`${late.length} supplier${late.length === 1 ? "" : "s"}`}
                  note="On time less than 80% of the time"
                  tone={late.length ? "warn" : undefined}
                />
              </div>

              <ChartCard
                title="On-time delivery by supplier"
                subtitle="Share of deliveries that arrived by the expected date"
                empty={rated.length === 0 ? "No delivery history yet." : false}
                table={{
                  columns: ["Supplier", "On time", "Payment terms"],
                  rows: details.map((d) => [d.name, d.onTimeDeliveryRate === null ? "No history" : `${Math.round(d.onTimeDeliveryRate * 100)}%`, `Net ${d.paymentTermsDays}`]),
                }}
              >
                <BarChart
                  max={100}
                  data={rated
                    .map((d) => ({ label: d.name, value: Math.round((d.onTimeDeliveryRate ?? 0) * 100), detail: `Net ${d.paymentTermsDays} terms` }))
                    .sort((a, b) => a.value - b.value)}
                  format={(v) => `${v}%`}
                />
              </ChartCard>
            </>
          );
        }}
      </Show>

      <Show live={orders} what="Purchase orders">
        {(all) => {
          const spend = new Map<string, number>();
          for (const o of all.filter((o) => o.currency === "KES" && !["DRAFT", "PENDING_APPROVAL"].includes(o.status))) {
            spend.set(o.supplierName, (spend.get(o.supplierName) ?? 0) + Number(o.totalAmount));
          }
          const rows = [...spend.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
          return (
            <ChartCard
              title="Spend by supplier"
              subtitle="Approved purchase orders, KES"
              empty={rows.length === 0 ? "No approved orders yet." : false}
              table={{ columns: ["Supplier", "Spend"], rows: rows.map((r) => [r.label, formatMoney(r.value)]) }}
            >
              <BarChart data={rows} format={(v) => formatMoney(v)} />
            </ChartCard>
          );
        }}
      </Show>
    </AppShell>
  );
}
