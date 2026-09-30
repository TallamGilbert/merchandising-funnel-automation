"use client";

import { BarChart, ChartCard, formatDateTime, formatMoney, ShareBar } from "@mms/ui";
import { AppShell } from "../../components/AppShell";
import { Kpi, OpenApp, Show } from "../../components/Panels";
import { NAV, STATUS_CARD } from "../../lib/nav";
import { APP_URL, type PoStatus, services } from "../../lib/services";
import { useLive } from "../../lib/useLive";

const STATUS_LABEL: Record<PoStatus, string> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Pending approval",
  APPROVED: "Approved",
  SENT: "Sent to supplier",
  PARTIALLY_RECEIVED: "Partially received",
  CLOSED: "Received in full",
};

const COMMITTED: PoStatus[] = ["APPROVED", "SENT", "PARTIALLY_RECEIVED", "CLOSED"];
const OPEN: PoStatus[] = ["APPROVED", "SENT", "PARTIALLY_RECEIVED"];

export default function PurchasingPage() {
  const orders = useLive(() => services.purchaseOrders(), []);

  return (
    <AppShell
      brandName="Executive"
      nav={NAV}
      statusCard={STATUS_CARD}
      title="Purchasing"
      subtitle="What the business has committed to buy, from whom, and what's waiting for a decision. KES orders only."
      actions={<OpenApp href={APP_URL.procurement} label="Procurement Dashboard" />}
    >
      <Show live={orders} what="Purchase orders">
        {(all) => {
          // Amounts are labelled, never converted (PRD §2.2).
          const kes = all.filter((o) => o.currency === "KES");
          const sum = (list: typeof all) => list.reduce((s, o) => s + Number(o.totalAmount), 0);
          const pending = kes.filter((o) => o.status === "PENDING_APPROVAL").sort((a, b) => a.createdAt.localeCompare(b.createdAt));
          const open = kes.filter((o) => OPEN.includes(o.status));

          const spend = new Map<string, number>();
          for (const o of kes.filter((o) => COMMITTED.includes(o.status))) spend.set(o.supplierName, (spend.get(o.supplierName) ?? 0) + Number(o.totalAmount));
          const bySupplier = [...spend.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);

          const counts = new Map<PoStatus, number>();
          for (const o of all) counts.set(o.status, (counts.get(o.status) ?? 0) + 1);
          const byStatus = (Object.keys(STATUS_LABEL) as PoStatus[]).filter((s) => counts.get(s)).map((s) => ({ label: STATUS_LABEL[s], value: counts.get(s) ?? 0 }));

          return (
            <>
              <div className="mms-chart-grid">
                <Kpi
                  label="Waiting for approval"
                  value={formatMoney(sum(pending))}
                  note={`${pending.length} purchase order${pending.length === 1 ? "" : "s"}`}
                  tone={pending.length ? "warn" : undefined}
                />
                <Kpi label="On order" value={formatMoney(sum(open))} note={`${open.length} approved order(s) not yet fully received`} />
                <Kpi label="Committed so far" value={formatMoney(bySupplier.reduce((s, x) => s + x.value, 0))} note={`With ${bySupplier.length} supplier(s)`} />
              </div>

              {pending.length > 0 && (
                <div className="card" style={{ padding: 0 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Waiting for approval</th>
                        <th>Supplier</th>
                        <th>Raised</th>
                        <th className="num">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pending.map((o) => (
                        <tr key={o.id}>
                          <td>
                            <a href={`${APP_URL.procurement}/purchase-orders/${o.id}`} target="_blank" rel="noreferrer">
                              {o.poNumber}
                            </a>
                          </td>
                          <td>{o.supplierName}</td>
                          <td>{formatDateTime(o.createdAt)}</td>
                          <td className="num">{formatMoney(o.totalAmount, o.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mms-chart-grid">
                <ChartCard
                  title="Committed spend by supplier"
                  subtitle="Approved, sent and received orders"
                  empty={bySupplier.length === 0 ? "No approved orders yet." : false}
                  table={{ columns: ["Supplier", "Committed"], rows: bySupplier.map((s) => [s.label, formatMoney(s.value)]) }}
                >
                  <BarChart data={bySupplier} format={(v) => formatMoney(v)} />
                </ChartCard>
                <ChartCard
                  title="Orders by stage"
                  subtitle={`${all.length} purchase orders`}
                  empty={all.length === 0 ? "No purchase orders yet." : false}
                  table={{ columns: ["Stage", "Orders"], rows: byStatus.map((s) => [s.label, s.value]) }}
                >
                  <ShareBar segments={byStatus} format={(v) => `${v} order${v === 1 ? "" : "s"}`} />
                </ChartCard>
              </div>
            </>
          );
        }}
      </Show>
    </AppShell>
  );
}
