"use client";

import { useState } from "react";
import { SERIES_COLORS } from "./colors";

export interface ShareSegment {
  label: string;
  value: number;
}

/**
 * Part-to-whole as one stacked bar (the readable alternative to a pie):
 * segments in fixed series order with a 2px gap, and a legend that carries
 * each segment's value and share so identity never rests on color alone.
 */
export function ShareBar({ segments, format }: { segments: ShareSegment[]; format: (value: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  const visible = segments.filter((s) => s.value > 0).slice(0, SERIES_COLORS.length);
  const total = visible.reduce((sum, s) => sum + s.value, 0);
  const share = (v: number) => (total > 0 ? Math.round((v / total) * 1000) / 10 : 0);

  return (
    <div className="mms-share">
      <div className="mms-share-bar">
        {visible.map((s, i) => (
          <span
            key={s.label}
            tabIndex={0}
            className={`mms-share-seg${hover === i ? " active" : ""}`}
            style={{ flexGrow: s.value, background: SERIES_COLORS[i] }}
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => setHover(null)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            aria-label={`${s.label}: ${format(s.value)} (${share(s.value)}%)`}
          >
            {hover === i && (
              <span className="mms-tooltip" style={{ left: 0 }}>
                <strong>{format(s.value)}</strong>
                <span>
                  {s.label} · {share(s.value)}%
                </span>
              </span>
            )}
          </span>
        ))}
      </div>
      <ul className="mms-legend">
        {visible.map((s, i) => (
          <li key={s.label}>
            <span className="mms-swatch" style={{ background: SERIES_COLORS[i] }} />
            <span>{s.label}</span>
            <strong className="num">{format(s.value)}</strong>
            <span className="muted">{share(s.value)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
