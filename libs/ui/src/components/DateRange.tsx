"use client";

import { useState } from "react";

export interface Range {
  from: string;
  to: string;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function today(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

const PRESETS: { key: string; label: string; range: () => Range }[] = [
  {
    key: "month",
    label: "This month",
    range: () => {
      const t = today();
      return { from: iso(new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1))), to: iso(t) };
    },
  },
  ...[7, 30, 90].map((days) => ({
    key: `${days}`,
    label: `Last ${days} days`,
    range: () => {
      const t = today();
      const from = new Date(t);
      from.setUTCDate(from.getUTCDate() - (days - 1));
      return { from: iso(from), to: iso(t) };
    },
  })),
];

export function defaultRange(): Range {
  return PRESETS[2].range();
}

/** Presets first (what people reach for), then a custom from/to. */
export function DateRange({ value, onChange }: { value: Range; onChange: (range: Range) => void }) {
  const [custom, setCustom] = useState(false);
  const active = PRESETS.find((p) => {
    const r = p.range();
    return r.from === value.from && r.to === value.to;
  })?.key;

  return (
    <div className="row-between" style={{ justifyContent: "flex-start", flexWrap: "wrap", gap: "0.5rem" }}>
      {PRESETS.map((p) => (
        <button
          key={p.key}
          type="button"
          className={!custom && active === p.key ? "primary" : undefined}
          onClick={() => {
            setCustom(false);
            onChange(p.range());
          }}
        >
          {p.label}
        </button>
      ))}
      <button type="button" className={custom || !active ? "primary" : undefined} onClick={() => setCustom(true)}>
        Custom
      </button>
      {(custom || !active) && (
        <>
          <input type="date" value={value.from} max={value.to} onChange={(e) => onChange({ ...value, from: e.target.value })} />
          <span className="muted">to</span>
          <input type="date" value={value.to} min={value.from} onChange={(e) => onChange({ ...value, to: e.target.value })} />
        </>
      )}
    </div>
  );
}
