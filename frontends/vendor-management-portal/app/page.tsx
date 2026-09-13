"use client";

import { useEffect, useState } from "react";

// Inlined at build time by Next.js — see .env.example for the full set of
// NEXT_PUBLIC_* vars this app reads. Mirrors the backend's own feature flag
// (NEXT_PUBLIC_FEATURE_VENDOR_MANAGEMENT_ENABLED) so the frontend and its backend module enable/disable together.
const FEATURE_ENABLED =
  process.env.NEXT_PUBLIC_FEATURE_VENDOR_MANAGEMENT_ENABLED !== "false";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

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
        <h1>Vendor Management Portal</h1>
        <p>
          <strong>Phase 1 — Foundation</strong> — this module is implemented, but its
          feature flag is currently off.
        </p>
        <p>
          Set <code>NEXT_PUBLIC_FEATURE_VENDOR_MANAGEMENT_ENABLED=true</code> to view it.
        </p>
      </main>
    );
  }

  return (
    <main style={{ fontFamily: "system-ui", padding: "3rem", maxWidth: 640 }}>
      <h1>Vendor Management Portal</h1>
      <p>Browse, add, edit, and archive supplier records.</p>
      <p>
        <strong>User:</strong> Procurement team and back-office administrators
      </p>
      <p>
        Backend: <code>http://localhost:3001</code> —{" "}
        {health.status === "checking" && "checking connectivity…"}
        {health.status === "ok" && `connected (${health.detail})`}
        {health.status === "error" && `unreachable (${health.detail})`}
      </p>
    </main>
  );
}
