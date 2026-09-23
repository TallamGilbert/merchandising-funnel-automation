"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell, type NavSection } from "../../components/AppShell";
import { ClipboardListIcon, PackageIcon } from "../../components/icons";
import { api, type GoodsReceivedNote, type GoodsReceivedNoteStatus } from "../../lib/api";

const NAV: NavSection[] = [
  {
    label: "Main menu",
    items: [
      { label: "Expected deliveries", href: "/", icon: <PackageIcon /> },
      { label: "Goods received notes", href: "/goods-received-notes", icon: <ClipboardListIcon /> },
    ],
  },
];

export default function GoodsReceivedNotesPage() {
  const [goodsReceivedNotes, setGoodsReceivedNotes] = useState<GoodsReceivedNote[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<GoodsReceivedNoteStatus | "">("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    api
      .listGoodsReceivedNotes(statusFilter || undefined)
      .then(setGoodsReceivedNotes)
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
            onChange={(e) => setStatusFilter(e.target.value as GoodsReceivedNoteStatus | "")}
          >
            <option value="">All</option>
            <option value="DRAFT">Draft</option>
            <option value="FINALIZED">Finalized</option>
          </select>
        </label>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {goodsReceivedNotes === null ? (
          <p className="muted" style={{ padding: "1.4rem" }}>
            Loading GRNs…
          </p>
        ) : goodsReceivedNotes.length === 0 ? (
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
              {goodsReceivedNotes.map((goodsReceivedNote) => {
                const flagged = goodsReceivedNote.lines.filter((l) => l.discrepancyType !== "NONE").length;
                return (
                  <tr key={goodsReceivedNote.id}>
                    <td>{goodsReceivedNote.goodsReceivedNoteNumber}</td>
                    <td>{goodsReceivedNote.poNumber}</td>
                    <td>{goodsReceivedNote.receivedAtLocation}</td>
                    <td>
                      <span className={`badge${goodsReceivedNote.status === "FINALIZED" ? " ok" : ""}`}>
                        {goodsReceivedNote.status}
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
                      <Link href={`/goods-received-notes/${goodsReceivedNote.id}`}>
                        {goodsReceivedNote.status === "DRAFT" ? "Continue" : "View"}
                      </Link>
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
