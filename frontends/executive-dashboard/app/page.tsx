"use client";

import Link from "next/link";
import { useState } from "react";
import {
  BarChart,
  ChartCard,
  formatCompact,
  formatDate,
  formatMoney,
  formatQuantity,
  TimeSeriesChart,
  useLocations,
} from "@mms/ui";
import { AppShell } from "../components/AppShell";
import { DateRange, defaultRange, type Range } from "../components/DateRange";
import { Kpi, Show, value } from "../components/Panels";
import { combineSales, todayIso } from "../lib/aggregate";
import { NAV, STATUS_CARD } from "../lib/nav";
import { services } from "../lib/services";
import { settled, useLive } from "../lib/useLive";

export default function OverviewPage() {
  const [range, setRange] = useState<Range>(defaultRange);
  const { data: stores } = useLocations("STORE");
  const storeCodes = stores.map((s) => s.code);
  const storeName = (code: string) => stores.find((s) => s.code === code)?.name ?? code;
  const today = todayIso();

  const sales = useLive(
    async () => combineSales((await settled(storeCodes, (c) => services.salesSummary(c, range.from, range.to))).map((r) => r.value)),
    [storeCodes.join(), range.from, range.to],
  );
  const finance = useLive(() => services.financeSummary(range.from, range.to), [range.from, range.to]);
  const valuation = useLive(() => services.valuation(), []);
  const orders = useLive(() => services.purchaseOrders(), []);
  const reorders = useLive(() => services.reorderSuggestions(), []);
  const deliveries = useLive(() => services.expectedDeliveries(), []);
  const putaways = useLive(() => services.pendingPutaways(), []);
  const closes = useLive(
    async () => (await settled(storeCodes, (c) => services.dailyClose(c, today))).map((r) => ({ storeId: r.item, close: r.value })),
    [storeCodes.join(), today],
  );

  const pendingApproval = orders.data?.filter((o) => o.status === "PENDING_APPROVAL") ?? [];
  const openDeliveries = deliveries.data?.filter((d) => d.status !== "RECEIVED") ?? [];
  const closedToday = closes.data?.filter((c) => c.close?.status === "CLOSED").length ?? 0;
  const blockedCloses = closes.data?.filter((c) => c.close?.status === "BLOCKED_ON_EXPLANATION") ?? [];

  // Things that need a decision, most urgent first. Only what's known is listed.
  const attention: { text: string; href: string; tone: "danger" | "warn" }[] = [];
  if (finance.data?.inbox.needsAttention)
    attention.push({ text: `${finance.data.inbox.needsAttention} accounting event(s) couldn't be booked`, href: "/finance", tone: "danger" });
  if (finance.data?.payables.overdueBills)
    attention.push({
      text: `${formatMoney(finance.data.payables.overdue)} overdue to suppliers on ${finance.data.payables.overdueBills} bill(s)`,
      href: "/finance",
      tone: "danger",
    });
  if (blockedCloses.length)
    attention.push({
      text: `${blockedCloses.map((c) => storeName(c.storeId)).join(", ")} can't close today until a cash discrepancy is explained`,
      href: "/stores",
      tone: "warn",
    });
  if (pendingApproval.length)
    attention.push({
      text: `${pendingApproval.length} purchase order(s) worth ${formatMoney(pendingApproval.reduce((s, o) => s + Number(o.totalAmount), 0))} waiting for approval`,
      href: "/purchasing",
      tone: "warn",
    });
  if (reorders.data?.length)
    attention.push({ text: `${reorders.data.length} product(s) running low and suggested for reorder`, href: "/inventory", tone: "warn" });

  return (
    <AppShell
      brandName="Executive"
      nav={NAV}
      statusCard={STATUS_CARD}
      title="Business overview"
      subtitle="Every area of the business on one page. Click a figure to see the detail behind it."
    >
      <DateRange value={range} onChange={setRange} />
      <p className="muted" style={{ margin: 0 }}>
        Sales and profit for {formatDate(range.from)} – {formatDate(range.to)}; everything else is as of now.
      </p>

      <div className="mms-chart-grid">
        <Kpi
          label="Sales"
          href="/sales"
          value={value(sales, (s) => formatMoney(s.sales))}
          note={sales.data ? `${formatQuantity(sales.data.transactions)} transactions across ${sales.data.stores.length} stores` : undefined}
        />
        <Kpi
          label="Gross profit"
          href="/finance"
          value={value(finance, (f) => formatMoney(f.grossProfit))}
          note={finance.data ? (finance.data.marginPct === null ? "No sales booked yet" : `${finance.data.marginPct}% margin on ${formatMoney(finance.data.revenue)} revenue`) : undefined}
        />
        <Kpi
          label="Stock on hand"
          href="/inventory"
          value={value(valuation, (v) => formatMoney(v.totalValue))}
          note={valuation.data ? `${valuation.data.byProduct.length} products at cost` : undefined}
        />
        <Kpi
          label="Owed to suppliers"
          href="/finance"
          tone={finance.data?.payables.overdueBills ? "danger" : undefined}
          value={value(finance, (f) => formatMoney(f.payables.outstanding))}
          note={finance.data ? (finance.data.payables.overdueBills ? `${formatMoney(finance.data.payables.overdue)} overdue` : "Nothing overdue") : undefined}
        />
        <Kpi
          label="Awaiting approval"
          href="/purchasing"
          tone={pendingApproval.length ? "warn" : undefined}
          value={value(orders, () => `${pendingApproval.length} PO${pendingApproval.length === 1 ? "" : "s"}`)}
          note={orders.data ? formatMoney(pendingApproval.reduce((s, o) => s + Number(o.totalAmount), 0)) : undefined}
        />
        <Kpi
          label="Deliveries expected"
          href="/warehouse"
          value={value(deliveries, () => formatQuantity(openDeliveries.length))}
          note={putaways.data ? `${putaways.data.length} putaway task(s) waiting` : undefined}
        />
        <Kpi
          label="Stores closed today"
          href="/stores"
          tone={blockedCloses.length ? "warn" : undefined}
          value={value(closes, () => `${closedToday} of ${storeCodes.length}`)}
          note={blockedCloses.length ? `${blockedCloses.length} blocked on a discrepancy` : undefined}
        />
        <Kpi
          label="Low stock"
          href="/inventory"
          tone={reorders.data?.length ? "warn" : undefined}
          value={value(reorders, (r) => `${r.length} product${r.length === 1 ? "" : "s"}`)}
          note="Suggested for reorder"
        />
      </div>

      <div className="card">
        <h3 style={{ margin: 0 }}>Needs attention</h3>
        {attention.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>Nothing is waiting on a decision right now.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: "1.1rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {attention.map((a) => (
              <li key={a.text}>
                <span className={`badge ${a.tone}`} style={{ marginRight: 8 }}>{a.tone === "danger" ? "Urgent" : "Review"}</span>
                <Link href={a.href}>{a.text}</Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Show live={sales} what="Sales">
        {(s) => (
          <div className="mms-chart-grid">
            <ChartCard
              title="Sales by day"
              subtitle="All stores, KES including VAT"
              empty={s.transactions === 0 ? "No sales in this period." : false}
              table={{
                columns: ["Date", "Sales", "Refunds", "Transactions"],
                rows: s.daily.map((d) => [formatDate(d.date), formatMoney(d.sales), formatMoney(d.returns), d.transactions]),
              }}
            >
              <TimeSeriesChart
                points={s.daily.map((d) => ({ date: d.date, values: { sales: d.sales } }))}
                series={[{ key: "sales", label: "Sales" }]}
                format={(v) => formatMoney(v)}
                formatTick={(v) => formatCompact(v)}
              />
            </ChartCard>
            <ChartCard
              title="Sales by store"
              subtitle="KES including VAT"
              empty={s.transactions === 0 ? "No sales in this period." : false}
              table={{ columns: ["Store", "Sales", "Transactions"], rows: s.stores.map((x) => [storeName(x.storeId), formatMoney(x.sales), x.transactions]) }}
            >
              <BarChart
                data={s.stores.map((x) => ({ label: storeName(x.storeId), value: x.sales, detail: `${x.transactions} transactions` }))}
                format={(v) => formatMoney(v)}
              />
            </ChartCard>
          </div>
        )}
      </Show>
    </AppShell>
  );
}
