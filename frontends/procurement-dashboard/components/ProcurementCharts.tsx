"use client";

import { BarChart, ChartCard, DEFAULT_CURRENCY, formatMoney, ShareBar } from "@mms/ui";
import type { PurchaseOrder, PurchaseOrderStatus } from "../lib/api";

const STATUS_LABEL: Record<PurchaseOrderStatus, string> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Pending approval",
  APPROVED: "Approved",
  SENT: "Sent",
  PARTIALLY_RECEIVED: "Partially received",
  CLOSED: "Closed",
};

// Drafts aren't commitments yet.
const COMMITTED: PurchaseOrderStatus[] = ["APPROVED", "SENT", "PARTIALLY_RECEIVED", "CLOSED"];

/** Committed spend by supplier and where orders sit in the approval flow. */
export function ProcurementCharts({ orders }: { orders: PurchaseOrder[] }) {
  // Amounts are labelled, never converted (PRD §2.2) — chart KES orders only.
  const kes = orders.filter((o) => o.currency === DEFAULT_CURRENCY);
  const otherCurrency = orders.length - kes.length;

  const spend = new Map<string, number>();
  for (const o of kes.filter((o) => COMMITTED.includes(o.status))) {
    spend.set(o.supplierName, (spend.get(o.supplierName) ?? 0) + Number(o.totalAmount));
  }
  const bySupplier = [...spend.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);

  const counts = new Map<PurchaseOrderStatus, number>();
  for (const o of orders) counts.set(o.status, (counts.get(o.status) ?? 0) + 1);
  const byStatus = (Object.keys(STATUS_LABEL) as PurchaseOrderStatus[])
    .filter((s) => counts.get(s))
    .map((s) => ({ label: STATUS_LABEL[s], value: counts.get(s) ?? 0 }));

  if (orders.length === 0) return null;

  return (
    <div className="mms-chart-grid">
      <ChartCard
        title="Committed spend by supplier"
        subtitle={`Approved, sent and received POs in KES${otherCurrency ? ` (${otherCurrency} in other currencies not shown)` : ""}`}
        empty={bySupplier.length === 0 ? "No approved purchase orders yet." : false}
        table={{ columns: ["Supplier", "Committed"], rows: bySupplier.map((s) => [s.label, formatMoney(s.value)]) }}
      >
        <BarChart data={bySupplier} format={(v) => formatMoney(v)} />
      </ChartCard>

      <ChartCard
        title="Orders by status"
        subtitle={`${orders.length} purchase orders`}
        table={{ columns: ["Status", "Orders"], rows: byStatus.map((s) => [s.label, s.value]) }}
      >
        <ShareBar segments={byStatus} format={(v) => `${v} order${v === 1 ? "" : "s"}`} />
      </ChartCard>
    </div>
  );
}
