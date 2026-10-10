"use client";

import { useState } from "react";
import { ExportMenu, exportUrl, formatDateTime, Pagination, useFlash, usePagedList } from "@mms/ui";
import { AppShell } from "../../components/AppShell";
import { NAV } from "../../lib/nav";
import { api, type ReorderSuggestionStatus } from "../../lib/api";


export default function ReorderSuggestionsPage() {
  const [statusFilter, setStatusFilter] = useState<ReorderSuggestionStatus | "">("NEW");
  const list = usePagedList(api.listReorderSuggestions, { status: statusFilter });

  const flash = useFlash();

  const dismiss = async (id: string, sku: string) => {
    try {
      await api.dismissReorderSuggestion(id);
      flash.success(`Suggestion for ${sku} dismissed`);
      list.reload();
    } catch (err) {
      flash.error((err as Error).message);
    }
  };

  return (
    <AppShell
      brandName="Procurement"
      nav={NAV}
      title="Reorder suggestions"
      subtitle="Advisory suggestions surfaced from low-stock events (FR-2.7). A human still creates the PO."
      search={{ value: list.q, onChange: list.setQ, placeholder: "Search SKU…" }}
      actions={<ExportMenu href={(format) => exportUrl(api.reorderSuggestionsUrl, list.params, format)} />}
    >
      {list.error && <p className="error">{list.error}</p>}

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
        {list.data === null ? (
          <p className="muted" style={{ padding: "1.4rem" }}>
            Loading…
          </p>
        ) : list.items.length === 0 ? (
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
              {list.items.map((s) => (
                <tr key={s.id}>
                  <td>
                    <code>{s.sku}</code>
                  </td>
                  <td>{s.reason}</td>
                  <td>
                    <span className="badge">{s.status}</span>
                  </td>
                  <td>{formatDateTime(s.createdAt)}</td>
                  <td>
                    {s.status === "NEW" && (
                      <button onClick={() => dismiss(s.id, s.sku)}>Dismiss</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pagination data={list.data} onPageChange={list.setPage} />
      </div>
    </AppShell>
  );
}
