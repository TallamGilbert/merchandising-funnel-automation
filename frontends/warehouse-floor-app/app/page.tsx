"use client";

import { useEffect, useState } from "react";

// Inlined at build time by Next.js — see .env.example for the full set of
// NEXT_PUBLIC_* vars this app reads. Mirrors the backend's own feature flag
// (NEXT_PUBLIC_FEATURE_WAREHOUSE_OPERATIONS_ENABLED) so the frontend and its backend module enable/disable together.
const FEATURE_ENABLED =
  process.env.NEXT_PUBLIC_FEATURE_WAREHOUSE_OPERATIONS_ENABLED !== "false";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3005";

type HealthState =
  | { status: "checking" }
  | { status: "ok"; detail: string }
  | { status: "error"; detail: string };

export default function Page() {
  const [health, setHealth] = useState<HealthState>({ status: "checking" });

  useEffect(() => {
    if (!FEATURE_ENABLED) return;
    fetch(`${API_URL}/health`)
      .then((res) => res.json())
      .then((data) =>
        setHealth({ status: "ok", detail: `${data.service} — ${data.status}` }),
      )
      .catch((err: Error) => setHealth({ status: "error", detail: err.message }));
  }, []);

  if (!FEATURE_ENABLED) {
    return (
      <main style={{ fontFamily: "system-ui", padding: "3rem", maxWidth: 640 }}>
        <h1>Warehouse Floor App</h1>
        <p>
          <strong>Phase 2 — Warehouse</strong> — not yet implemented.
        </p>
        <p>
          This module is scaffold-only and gated behind its feature flag. Set{" "}
          <code>NEXT_PUBLIC_FEATURE_WAREHOUSE_OPERATIONS_ENABLED=true</code> once the{" "}
          <code>warehouse-operations</code> backend service ships this phase.
        </p>
      </main>
    );
  }

  return (
    <main style={{ fontFamily: "system-ui", padding: "3rem", maxWidth: 640 }}>
      <h1>Warehouse Floor App</h1>
      <p>Directs pickers and forklift drivers to bins for putaway and picking.</p>
      <p>
        <strong>User:</strong> Warehouse pickers, forklift drivers, and floor supervisors
      </p>
      <p>
        Backend: <code>http://localhost:3005</code> —{" "}
        {health.status === "checking" && "checking connectivity…"}
        {health.status === "ok" && `connected (${health.detail})`}
        {health.status === "error" && `unreachable (${health.detail})`}
      </p>
    </main>
  );
}
