"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell, type NavSection } from "../../components/AppShell";
import { ClipboardListIcon, PackageIcon } from "../../components/icons";
import { api, type Grn, type GrnStatus } from "../../lib/api";

const NAV: NavSection[] = [
  {
    label: "Main menu",
    items: [
      { label: "Expected deliveries", href: "/", icon: <PackageIcon /> },
      { label: "Goods received notes", href: "/grns", icon: <ClipboardListIcon /> },
    ],
  },
];

export default function GrnsPage() {
  const [grns, setGrns] = useState<Grn[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<GrnStatus | "">("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    api
      .listGrns(statusFilter || undefined)
      .then(setGrns)
      .catch((err: Error) => setError(err.message));
  }, [statusFilter]);

  return (
    <AppShell
      brandName="Receiving"
      nav={NAV}
      title="Goods received notes"
      subtitle="The system-of-record for possession (FR-3.5). Drafts are still being scanned; finalized GRNs are locked."
    >
      {error && <p className="error">{error}</p>}

      <div className="row-between">
        <label style={{ maxWidth: 220 }}>
          Status
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as GrnStatus | "")}
          >
            <option value="">All</option>
            <option value="DRAFT">Draft</option>
            <option value="FINALIZED">Finalized</option>
          </select>
        </label>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {grns === null ? (
          <p className="muted" style={{ padding: "1.4rem" }}>
            Loading GRNs…
          </p>
        ) : grns.length === 0 ? (
          <p className="muted" style={{ padding: "1.4rem" }}>
            No GRNs found.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>GRN</th>
                <th>PO</th>
                <th>Location</th>
                <th>Status</th>
                <th>Discrepancies</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {grns.map((grn) => {
                const flagged = grn.lines.filter((l) => l.discrepancyType !== "NONE").length;
                return (
                  <tr key={grn.id}>
                    <td>{grn.grnNumber}</td>
                    <td>{grn.poNumber}</td>
                    <td>{grn.receivedAtLocation}</td>
                    <td>
                      <span className={`badge${grn.status === "FINALIZED" ? " ok" : ""}`}>
                        {grn.status}
                      </span>
                    </td>
                    <td>
                      {flagged > 0 ? (
                        <span className="badge warn">{flagged} flagged</span>
                      ) : (
                        <span className="muted">None</span>
                      )}
                    </td>
                    <td>
                      <Link href={`/grns/${grn.id}`}>{grn.status === "DRAFT" ? "Continue" : "View"}</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
