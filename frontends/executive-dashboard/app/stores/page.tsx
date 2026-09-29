"use client";

import { useState } from "react";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatSignedMoney,
  useLocations,
  useStaffNames,
} from "@mms/ui";
import { AppShell } from "../../components/AppShell";
import { Kpi, OpenApp, Show } from "../../components/Panels";
import { todayIso } from "../../lib/aggregate";
import { NAV, STATUS_CARD } from "../../lib/nav";
import { APP_URL, services } from "../../lib/services";
import { settled, useLive } from "../../lib/useLive";

const STATUS_LABEL = { OPEN: "Counted, not closed", BLOCKED_ON_EXPLANATION: "Blocked: discrepancy", CLOSED: "Closed" } as const;

export default function StoreClosesPage() {
  const [businessDate, setBusinessDate] = useState(todayIso());
  const { data: stores } = useLocations("STORE");
  const nameOf = useStaffNames();
  const storeCodes = stores.map((s) => s.code);

  const rows = useLive(
    async () =>
      (
        await settled(storeCodes, async (code) => {
          const [close, ledger] = await Promise.all([
            services.dailyClose(code, businessDate),
            services.storeLedger(code, businessDate),
          ]);
          return { close, ledger };
        })
      ).map((r) => ({ storeId: r.item, ...r.value })),
    [storeCodes.join(), businessDate],
    30000,
  );

  return (
    <AppShell
      brandName="Executive"
      nav={NAV}
      statusCard={STATUS_CARD}
      title="Store closes"
      subtitle="Each store's day: what the tills should hold, what was counted, and whether the manager has closed."
      actions={<OpenApp href={APP_URL.storeManager} label="Store Manager Dashboard" />}
    >
      <label style={{ maxWidth: 220 }}>
        Business day
        <input type="date" value={businessDate} max={todayIso()} onChange={(e) => setBusinessDate(e.target.value)} />
      </label>

      <Show live={rows} what="Store closes">
        {(list) => {
          const expected = list.reduce((s, r) => s + Number(r.ledger?.expectedTotal ?? 0), 0);
          const discrepancy = list.reduce((s, r) => s + Number(r.close?.discrepancyAmount ?? 0), 0);
          const closed = list.filter((r) => r.close?.status === "CLOSED").length;
          return (
            <>
              <div className="mms-chart-grid">
                <Kpi label="Expected in the tills" value={formatMoney(expected)} note={`Across ${list.length} stores on ${formatDate(businessDate)}`} />
                <Kpi label="Closed" value={`${closed} of ${list.length}`} tone={closed < list.length && businessDate < todayIso() ? "warn" : undefined} />
                <Kpi
                  label="Net discrepancy"
                  value={discrepancy === 0 ? formatMoney(0) : formatSignedMoney(discrepancy)}
                  note={discrepancy < 0 ? "Short overall" : discrepancy > 0 ? "Over overall" : "Balanced so far"}
                  tone={discrepancy < 0 ? "warn" : undefined}
                />
              </div>

              <div className="card" style={{ padding: 0 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Store</th>
                      <th className="num">Expected</th>
                      <th className="num">Counted</th>
                      <th className="num">Discrepancy</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((r) => (
                      <tr key={r.storeId}>
                        <td>{stores.find((s) => s.code === r.storeId)?.name ?? r.storeId}</td>
                        <td className="num">{formatMoney(r.ledger?.expectedTotal ?? 0)}</td>
                        <td className="num">{r.close?.actualCountedTotal ? formatMoney(r.close.actualCountedTotal) : <span className="muted">Not counted</span>}</td>
                        <td className="num">
                          {r.close?.discrepancyAmount !== null && r.close?.discrepancyAmount !== undefined
                            ? Number(r.close.discrepancyAmount) === 0
                              ? formatMoney(0)
                              : formatSignedMoney(r.close.discrepancyAmount)
                            : "—"}
                          {r.close?.discrepancyExplanation && (
                            <div className="muted" style={{ fontSize: "0.78rem", whiteSpace: "normal" }}>{r.close.discrepancyExplanation}</div>
                          )}
                        </td>
                        <td>
                          {r.close ? (
                            <>
                              <span className={`badge ${r.close.status === "CLOSED" ? "ok" : r.close.status === "BLOCKED_ON_EXPLANATION" ? "warn" : ""}`}>
                                {STATUS_LABEL[r.close.status]}
                              </span>
                              {r.close.closedAt && (
                                <div className="muted" style={{ fontSize: "0.78rem" }}>
                                  by {nameOf(r.close.closedByManagerId)}, {formatDateTime(r.close.closedAt)}
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="badge">Trading</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          );
        }}
      </Show>
    </AppShell>
  );
}
