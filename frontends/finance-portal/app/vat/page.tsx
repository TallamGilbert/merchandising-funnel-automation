"use client";

import { useEffect, useState } from "react";
import { DateRange, defaultRange, ExportMenu, formatMoney, type Range, withQuery } from "@mms/ui";
import { AppShell } from "../../components/AppShell";
import { api, type VatReport } from "../../lib/financials-client";
import { NAV } from "../../lib/nav";

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-KE", { month: "long", year: "numeric", timeZone: "UTC" });
}

/**
 * D-20 — what the VAT-payable account did each month. Output VAT only:
 * supplier bills don't record input VAT, so this isn't a full VAT return.
 */
export default function VatPage() {
  const [range, setRange] = useState<Range>(defaultRange);
  const [report, setReport] = useState<VatReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setReport(null);
    setError(null);
    api
      .vat(range.from, range.to)
      .then(setReport)
      .catch((err: Error) => setError(err.message));
  }, [range.from, range.to]);

  return (
    <AppShell
      brandName="Finance"
      nav={NAV}
      title="VAT"
      subtitle="VAT charged on sales and given back on refunds, from the VAT payable account (2100). Output VAT only — supplier bills don't record input VAT, so check purchase invoices before filing."
      actions={<ExportMenu href={(format) => withQuery(api.vatUrl, { from: range.from, to: range.to, format })} />}
    >
      <DateRange value={range} onChange={setRange} />
      {error && <p className="error">{error}</p>}

      {report && (
        <div className="mms-chart-grid">
          <div className="stat-card">
            <span className="muted">Output VAT on sales</span>
            <p className="stat-value">{formatMoney(report.total.outputVat)}</p>
          </div>
          <div className="stat-card">
            <span className="muted">Refunded on returns</span>
            <p className="stat-value">{formatMoney(report.total.refundedVat)}</p>
          </div>
          <div className="stat-card">
            <span className="muted">Net VAT for the period</span>
            <p className="stat-value">{formatMoney(report.total.netVat)}</p>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        {report === null ? (
          !error && <p className="muted" style={{ padding: "1.4rem" }}>Loading…</p>
        ) : report.months.length === 0 ? (
          <p className="muted" style={{ padding: "1.4rem" }}>No VAT postings in this period.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th className="num">Output VAT</th>
                <th className="num">Refunded</th>
                <th className="num">Other adjustments</th>
                <th className="num">Net</th>
              </tr>
            </thead>
            <tbody>
              {report.months.map((m) => (
                <tr key={m.month}>
                  <td>{monthLabel(m.month)}</td>
                  <td className="num">{formatMoney(m.outputVat)}</td>
                  <td className="num">{formatMoney(m.refundedVat)}</td>
                  <td className="num">{formatMoney(m.otherAdjustments)}</td>
                  <td className="num">
                    <strong>{formatMoney(m.netVat)}</strong>
                  </td>
                </tr>
              ))}
              <tr>
                <td>
                  <strong>Total</strong>
                </td>
                <td className="num">{formatMoney(report.total.outputVat)}</td>
                <td className="num">{formatMoney(report.total.refundedVat)}</td>
                <td className="num">{formatMoney(report.total.otherAdjustments)}</td>
                <td className="num">
                  <strong>{formatMoney(report.total.netVat)}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
