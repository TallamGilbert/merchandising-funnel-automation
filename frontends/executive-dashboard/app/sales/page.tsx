"use client";

import { useState } from "react";
import {
  BarChart,
  ChartCard,
  DateRange,
  defaultRange,
  formatCompact,
  formatDate,
  formatMoney,
  formatQuantity,
  lookupApi,
  type Range,
  ShareBar,
  TimeSeriesChart,
  useLocations,
} from "@mms/ui";
import { AppShell } from "../../components/AppShell";
import { Kpi, OpenApp, Show } from "../../components/Panels";
import { combineSales, PAYMENT_LABEL } from "../../lib/aggregate";
import { NAV, STATUS_CARD } from "../../lib/nav";
import { APP_URL, services } from "../../lib/services";
import { settled, useLive } from "../../lib/useLive";

export default function SalesPage() {
  const [range, setRange] = useState<Range>(defaultRange);
  const { data: stores } = useLocations("STORE");
  const storeCodes = stores.map((s) => s.code);
  const storeName = (code: string) => stores.find((s) => s.code === code)?.name ?? code;

  const sales = useLive(
    async () => combineSales((await settled(storeCodes, (c) => services.salesSummary(c, range.from, range.to))).map((r) => r.value)),
    [storeCodes.join(), range.from, range.to],
  );
  const hours = useLive(() => services.salesReport(range.from, range.to, "hour"), [range.from, range.to]);
  const categories = useLive(async () => {
    const [bySku, products] = await Promise.all([
      services.salesReport(range.from, range.to, "sku"),
      lookupApi.listCatalogProducts(),
    ]);
    const categoryOf = new Map(products.map((p) => [p.sku, p.category ?? "Uncategorised"]));
    const net = new Map<string, number>();
    for (const row of bySku) {
      const category = categoryOf.get(row.key) ?? "Uncategorised";
      net.set(category, (net.get(category) ?? 0) + row.net);
    }
    return [...net.entries()].map(([label, value]) => ({ label, value: Math.round(value * 100) / 100 })).sort((a, b) => b.value - a.value);
  }, [range.from, range.to]);

  return (
    <AppShell
      brandName="Executive"
      nav={NAV}
      statusCard={STATUS_CARD}
      title="Sales"
      subtitle="What every store sold, how customers paid, and what sells best. Amounts include VAT."
      actions={<OpenApp href={APP_URL.storeManager} label="Store Manager Dashboard" />}
    >
      <DateRange value={range} onChange={setRange} />

      <Show live={sales} what="Sales">
        {(s) => (
          <>
            <div className="mms-chart-grid">
              <Kpi label="Sales" value={formatMoney(s.sales)} note={`${formatDate(range.from)} – ${formatDate(range.to)}`} />
              <Kpi label="Transactions" value={formatQuantity(s.transactions)} note={`Average sale ${formatMoney(s.averageSale)}`} />
              <Kpi
                label="Refunds"
                value={formatMoney(s.returns)}
                note={s.sales > 0 ? `${Math.round((s.returns / s.sales) * 1000) / 10}% of sales` : "—"}
                tone={s.sales > 0 && s.returns / s.sales > 0.05 ? "warn" : undefined}
              />
            </div>

            <ChartCard
              title="Sales and refunds by day"
              subtitle="All stores"
              empty={s.transactions === 0 && s.returns === 0 ? "No sales in this period." : false}
              table={{
                columns: ["Date", "Sales", "Refunds", "Transactions"],
                rows: s.daily.map((d) => [formatDate(d.date), formatMoney(d.sales), formatMoney(d.returns), d.transactions]),
              }}
            >
              <TimeSeriesChart
                points={s.daily.map((d) => ({ date: d.date, values: { sales: d.sales, returns: d.returns } }))}
                series={[
                  { key: "sales", label: "Sales" },
                  { key: "returns", label: "Refunds" },
                ]}
                format={(v) => formatMoney(v)}
                formatTick={(v) => formatCompact(v)}
              />
            </ChartCard>

            <div className="mms-chart-grid">
              <ChartCard
                title="Sales by store"
                empty={s.transactions === 0 ? "No sales in this period." : false}
                table={{
                  columns: ["Store", "Sales", "Refunds", "Transactions"],
                  rows: s.stores.map((x) => [storeName(x.storeId), formatMoney(x.sales), formatMoney(x.returns), x.transactions]),
                }}
              >
                <BarChart
                  data={s.stores.map((x) => ({
                    label: storeName(x.storeId),
                    value: x.sales,
                    detail: `${x.transactions} transactions · ${formatMoney(x.returns)} refunded`,
                  }))}
                  format={(v) => formatMoney(v)}
                />
              </ChartCard>

              <ChartCard
                title="How customers paid"
                empty={s.paymentMix.length === 0 ? "No payments in this period." : false}
                table={{ columns: ["Method", "Amount"], rows: s.paymentMix.map((p) => [PAYMENT_LABEL[p.method] ?? p.method, formatMoney(p.amount)]) }}
              >
                <ShareBar
                  segments={s.paymentMix.map((p) => ({ label: PAYMENT_LABEL[p.method] ?? p.method, value: p.amount }))}
                  format={(v) => formatMoney(v)}
                />
              </ChartCard>
            </div>

            <ChartCard
              title="Best sellers"
              subtitle="Each store's top products, combined, by revenue"
              empty={s.topProducts.length === 0 ? "Nothing sold in this period." : false}
              table={{
                columns: ["Product", "Units", "Revenue"],
                rows: s.topProducts.map((p) => [p.productName, p.quantity, formatMoney(p.revenue)]),
              }}
            >
              <BarChart
                data={s.topProducts.map((p) => ({ label: p.productName, value: p.revenue, detail: `${formatQuantity(p.quantity)} units · ${p.sku}` }))}
                format={(v) => formatMoney(v)}
              />
            </ChartCard>
          </>
        )}
      </Show>

      <div className="mms-chart-grid">
        <Show live={hours} what="Sales by hour">
          {(rows) => (
            <ChartCard
              title="Busiest hours"
              subtitle="Net sales by hour of day, all stores, local time"
              empty={rows.length === 0 ? "Nothing sold in this period." : false}
              table={{ columns: ["Hour", "Sales count", "Net"], rows: rows.map((r) => [`${r.key}:00`, r.transactions, formatMoney(r.net)]) }}
            >
              <BarChart
                data={rows.map((r) => ({ label: `${r.key}:00`, value: r.net, detail: `${r.transactions} sale(s)` }))}
                format={(v) => formatMoney(v)}
              />
            </ChartCard>
          )}
        </Show>
        <Show live={categories} what="Sales by category">
          {(rows) => (
            <ChartCard
              title="Sales by category"
              subtitle="Net sales, all stores"
              empty={rows.length === 0 ? "Nothing sold in this period." : false}
              table={{ columns: ["Category", "Net"], rows: rows.map((r) => [r.label, formatMoney(r.value)]) }}
            >
              <BarChart data={rows} format={(v) => formatMoney(v)} />
            </ChartCard>
          )}
        </Show>
      </div>
    </AppShell>
  );
}
