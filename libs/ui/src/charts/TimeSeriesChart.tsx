"use client";

import { PointerEvent, useEffect, useRef, useState } from "react";
import { SERIES_COLORS } from "./colors";

export interface TimeSeries {
  key: string;
  label: string;
}

export interface TimePoint {
  /** Business date, YYYY-MM-DD. */
  date: string;
  values: Record<string, number>;
}

const HEIGHT = 220;
const PAD = { top: 12, right: 16, bottom: 28, left: 64 };

function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0];
  const raw = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(v);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

function shortDate(date: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${date}T12:00:00Z`),
  );
}

/**
 * Change over time for one to three series sharing one axis. A vertical
 * crosshair snaps to the nearest day and the tooltip lists every series.
 */
export function TimeSeriesChart({
  points,
  series,
  format,
  formatTick = format,
}: {
  points: TimePoint[];
  series: TimeSeries[];
  format: (value: number) => string;
  formatTick?: (value: number) => string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(entry.contentRect.width, 280)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const plotW = width - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const max = Math.max(0, ...points.flatMap((p) => series.map((s) => p.values[s.key] ?? 0)));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] || 1;
  const x = (i: number) => PAD.left + (points.length <= 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;
  const labelEvery = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(plotW / 70))));

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - box.left) / box.width;
    setHover(Math.round(rel * (points.length - 1)));
  };

  const hovered = hover !== null ? points[hover] : null;

  return (
    <div className="mms-timeseries" ref={ref}>
      {series.length > 1 && (
        <ul className="mms-legend inline">
          {series.map((s, i) => (
            <li key={s.key}>
              <span className="mms-line-key" style={{ background: SERIES_COLORS[i] }} />
              <span>{s.label}</span>
            </li>
          ))}
        </ul>
      )}
      <svg width={width} height={HEIGHT} role="img" aria-label={`${series.map((s) => s.label).join(" and ")} by day`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} className={t === 0 ? "mms-axis" : "mms-grid"} />
            <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="mms-tick">
              {formatTick(t)}
            </text>
          </g>
        ))}
        {points.map((p, i) =>
          i % labelEvery === 0 || i === points.length - 1 ? (
            <text key={p.date} x={x(i)} y={HEIGHT - 8} textAnchor="middle" className="mms-tick">
              {shortDate(p.date)}
            </text>
          ) : null,
        )}
        {series.map((s, si) => (
          <g key={s.key}>
            <path
              d={`M${x(0)},${y(0)} ${points.map((p, i) => `L${x(i)},${y(p.values[s.key] ?? 0)}`).join(" ")} L${x(points.length - 1)},${y(0)} Z`}
              fill={SERIES_COLORS[si]}
              opacity={series.length === 1 ? 0.1 : 0}
            />
            <path
              d={points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.values[s.key] ?? 0)}`).join(" ")}
              fill="none"
              stroke={SERIES_COLORS[si]}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </g>
        ))}
        {hovered && hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH} className="mms-crosshair" />
            {series.map((s, si) => (
              <circle
                key={s.key}
                cx={x(hover)}
                cy={y(hovered.values[s.key] ?? 0)}
                r={4}
                fill={SERIES_COLORS[si]}
                stroke="var(--surface)"
                strokeWidth={2}
              />
            ))}
          </g>
        )}
        <rect
          x={PAD.left}
          y={PAD.top}
          width={plotW}
          height={plotH}
          fill="transparent"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        />
      </svg>
      {hovered && hover !== null && (
        <div
          className="mms-tooltip"
          style={{ top: PAD.top + (series.length > 1 ? 28 : 0), left: Math.min(x(hover) + 12, width - 200) }}
        >
          <span>{new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${hovered.date}T12:00:00Z`))}</span>
          {series.map((s, si) => (
            <span key={s.key} className="mms-tooltip-row">
              <span className="mms-line-key" style={{ background: SERIES_COLORS[si] }} />
              <strong>{format(hovered.values[s.key] ?? 0)}</strong>
              <span>{s.label}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
