"use client";

import { useState } from "react";

export interface BarDatum {
  label: string;
  value: number;
  /** Extra line in the tooltip, e.g. "12 units". */
  detail?: string;
}

/**
 * Horizontal bars for comparing magnitude across named things (best
 * sellers, stock by location). One series, one hue; the value sits at the
 * bar's tip and the tooltip repeats it with any detail.
 */
export function BarChart({
  data,
  format,
  max,
}: {
  data: BarDatum[];
  format: (value: number) => string;
  /** Fixed scale top, e.g. 100 for percentages. Defaults to the largest value. */
  max?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const top = max ?? Math.max(...data.map((d) => d.value), 0);

  return (
    <div className="mms-bars" role="list">
      {data.map((d, i) => {
        const pct = top > 0 ? Math.max((d.value / top) * 100, d.value > 0 ? 0.8 : 0) : 0;
        return (
          <div
            key={d.label}
            role="listitem"
            tabIndex={0}
            className={`mms-bar-row${hover === i ? " active" : ""}`}
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => setHover(null)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            aria-label={`${d.label}: ${format(d.value)}${d.detail ? `, ${d.detail}` : ""}`}
          >
            <span className="mms-bar-label">{d.label}</span>
            <span className="mms-bar-track">
              <span className="mms-bar" style={{ width: `${pct}%` }} />
              <span className="mms-bar-value">{format(d.value)}</span>
              {hover === i && (
                <span className="mms-tooltip" style={{ left: `min(${pct}%, calc(100% - 180px))` }}>
                  <strong>{format(d.value)}</strong>
                  <span>{d.label}</span>
                  {d.detail && <span>{d.detail}</span>}
                </span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
