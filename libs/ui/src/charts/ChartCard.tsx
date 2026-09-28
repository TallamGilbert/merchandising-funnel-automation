"use client";

import { ReactNode, useState } from "react";

export interface ChartTable {
  columns: string[];
  rows: (string | number)[][];
}

/**
 * Frame for every chart: title, one-line subtitle, and a "Show table"
 * toggle — the accessible twin of the chart, so no value is hover-only.
 */
export function ChartCard({
  title,
  subtitle,
  table,
  empty,
  children,
}: {
  title: string;
  subtitle?: string;
  table: ChartTable;
  /** Shown instead of the chart when there's nothing to plot. */
  empty?: string | false;
  children: ReactNode;
}) {
  const [showTable, setShowTable] = useState(false);

  return (
    <figure className="card mms-chart-card">
      <figcaption className="row-between">
        <div>
          <h3 style={{ margin: 0 }}>{title}</h3>
          {subtitle && <p className="muted" style={{ margin: "0.2rem 0 0", fontSize: "0.85rem" }}>{subtitle}</p>}
        </div>
        {!empty && (
          <button type="button" className="mms-link-btn" onClick={() => setShowTable((v) => !v)}>
            {showTable ? "Show chart" : "Show table"}
          </button>
        )}
      </figcaption>
      {empty ? (
        <p className="muted" style={{ margin: 0 }}>{empty}</p>
      ) : showTable ? (
        <table>
          <thead>
            <tr>
              {table.columns.map((c, i) => (
                <th key={c} className={i > 0 ? "num" : undefined}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, i) => (
                  <td key={i} className={i > 0 ? "num" : undefined}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        children
      )}
    </figure>
  );
}
