"use client";

import { useEffect, useState } from "react";
import { AppShell, type NavSection } from "../../components/AppShell";
import { BellAlertIcon, ClipboardListIcon } from "../../components/icons";
import { api, type ReorderSuggestion, type ReorderSuggestionStatus } from "../../lib/api";

const NAV: NavSection[] = [
  {
    label: "Main menu",
    items: [
      { label: "Purchase orders", href: "/", icon: <ClipboardListIcon /> },
      { label: "Reorder suggestions", href: "/reorder-suggestions", icon: <BellAlertIcon /> },
    ],
  },
];

export default function ReorderSuggestionsPage() {
  const [suggestions, setSuggestions] = useState<ReorderSuggestion[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<ReorderSuggestionStatus | "">("NEW");
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    api
      .listReorderSuggestions(statusFilter || undefined)
      .then(setSuggestions)
      .catch((err: Error) => setError(err.message));
  };

  useEffect(load, [statusFilter]);

  const dismiss = async (id: string) => {
    await api.dismissReorderSuggestion(id);
    load();
  };

  return (
    <AppShell
      brandName="Procurement"
      nav={NAV}
      title="Reorder suggestions"
      subtitle="Advisory suggestions surfaced from low-stock events (FR-2.7). A human still creates the PO."
    >
      {error && <p className="error">{error}</p>}

      <div className="row-between">
        <label style={{ maxWidth: 220 }}>
          Status
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ReorderSuggestionStatus | "")}
          >
            <option value="NEW">New</option>
            <option value="DISMISSED">Dismissed</option>
            <option value="CONVERTED">Converted</option>
            <option value="">All</option>
          </select>
        </label>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {suggestions === null ? (
          <p className="muted" style={{ padding: "1.4rem" }}>
            Loading…
          </p>
        ) : suggestions.length === 0 ? (
          <p className="muted" style={{ padding: "1.4rem" }}>
            No reorder suggestions.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Created</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {suggestions.map((s) => (
                <tr key={s.id}>
                  <td>
                    <code>{s.sku}</code>
                  </td>
                  <td>{s.reason}</td>
                  <td>
                    <span className="badge">{s.status}</span>
                  </td>
                  <td>{new Date(s.createdAt).toLocaleString()}</td>
                  <td>
                    {s.status === "NEW" && (
                      <button onClick={() => dismiss(s.id)}>Dismiss</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
