"use client";

import { useEffect, useState } from "react";

// Inlined at build time by Next.js — see .env.example for the full set of
// NEXT_PUBLIC_* vars this app reads. Mirrors the backend's own feature flag
// (NEXT_PUBLIC_FEATURE_RETAIL_SALES_ENABLED) so the frontend and its backend module enable/disable together.
const FEATURE_ENABLED = process.env.NEXT_PUBLIC_FEATURE_RETAIL_SALES_ENABLED !== "false";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3006";

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
        <h1>Point of Sale Terminal</h1>
        <p>
          <strong>Phase 3 — Retail</strong> — not yet implemented.
        </p>
        <p>
          This module is scaffold-only and gated behind its feature flag. Set{" "}
          <code>NEXT_PUBLIC_FEATURE_RETAIL_SALES_ENABLED=true</code> once the{" "}
          <code>retail-sales</code> backend service ships this phase.
        </p>
      </main>
    );
  }

  return (
    <main style={{ fontFamily: "system-ui", padding: "3rem", maxWidth: 640 }}>
      <h1>Point of Sale Terminal</h1>
      <p>Scan items, apply discounts, process payments, and print receipts.</p>
      <p>
        <strong>User:</strong> Cashiers at the retail storefront
      </p>
      <p>
        Backend: <code>http://localhost:3006</code> —{" "}
        {health.status === "checking" && "checking connectivity…"}
        {health.status === "ok" && `connected (${health.detail})`}
        {health.status === "error" && `unreachable (${health.detail})`}
      </p>
    </main>
  );
}
