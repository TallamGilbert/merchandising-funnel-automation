"use client";

import Link from "next/link";
import { ReactNode } from "react";
import type { Live } from "../lib/useLive";

/** One headline number. Links to the tab (or app) that explains it. */
export function Kpi({
  label,
  value,
  note,
  href,
  tone,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  href?: string;
  /** Draws the eye to something that needs action. */
  tone?: "warn" | "danger";
}) {
  const body = (
    <>
      <span className="muted">{label}</span>
      <p className="stat-value">{value}</p>
      {note && <p className="muted" style={{ margin: 0 }}>{note}</p>}
    </>
  );
  const style = tone ? { borderColor: tone === "danger" ? "var(--danger)" : "var(--warn)" } : undefined;
  return href ? (
    <Link href={href} className="stat-card exec-kpi" style={style}>
      {body}
    </Link>
  ) : (
    <div className="stat-card" style={style}>
      {body}
    </div>
  );
}

/** Shows a module's value, a quiet "unavailable" when it's down, or a placeholder while loading. */
export function Show<T>({ live, children, what }: { live: Live<T>; children: (data: T) => ReactNode; what: string }) {
  if (live.data !== null) {
    return <div style={{ opacity: live.loading ? 0.7 : 1, display: "contents" }}>{children(live.data)}</div>;
  }
  if (live.error) {
    return (
      <p className="card muted" style={{ margin: 0 }}>
        {what} unavailable right now ({live.error}). The rest of the dashboard is unaffected.
      </p>
    );
  }
  return <p className="muted" style={{ margin: 0 }}>Loading {what.toLowerCase()}…</p>;
}

/** The value of a KPI whose module may be down. */
export function value<T>(live: Live<T>, pick: (data: T) => ReactNode): ReactNode {
  if (live.data !== null) return pick(live.data);
  return live.error ? <span className="muted" style={{ fontSize: "1rem" }}>Unavailable</span> : "…";
}

export function OpenApp({ href, label }: { href: string; label: string }) {
  return (
    <a className="button-link" href={href} target="_blank" rel="noreferrer">
      Open {label} ↗
    </a>
  );
}
