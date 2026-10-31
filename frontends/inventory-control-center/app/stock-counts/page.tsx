"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ExportMenu,
  exportUrl,
  formatDateTime,
  formatMoney,
  LocationPicker,
  Pagination,
  useCurrentUser,
  useFlash,
  useLocations,
  usePagedList,
  useStaffNames,
} from "@mms/ui";
import { AppShell } from "../../components/AppShell";
import { api, type CountSuggestion, type StockCountStatus, type StockCountType } from "../../lib/api";
import { NAV } from "../../lib/nav";
import { canManageCounts, STATUS_BADGE, STATUS_LABEL } from "../../lib/stock-counts";

export default function StockCountsPage() {
  const user = useCurrentUser();
  const nameOf = useStaffNames();
  const { data: locations } = useLocations();
  const locationName = (code: string) => locations.find((l) => l.code === code)?.name ?? code;
  const [status, setStatus] = useState<StockCountStatus | "">("");
  const [showForm, setShowForm] = useState(false);
  const list = usePagedList(api.listStockCounts, { status });

  return (
    <AppShell
      brandName="Inventory"
      nav={NAV}
      title="Stock counts"
      subtitle="Count what's physically on the shelves. Variances adjust stock when a manager posts the count, and are booked as shrinkage in the ledger."
      search={{ value: list.q, onChange: list.setQ, placeholder: "Search count number…" }}
      actions={
        <>
          <ExportMenu href={(format) => exportUrl(api.stockCountsUrl, list.params, format)} />
          {canManageCounts(user.role) && (
            <button className="primary" onClick={() => setShowForm((v) => !v)}>
              {showForm ? "Cancel" : "New count"}
            </button>
          )}
        </>
      }
    >
      {showForm && <NewCountForm />}

      {list.error && <p className="error">{list.error}</p>}

      <div className="row-between">
        <label style={{ maxWidth: 220 }}>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value as StockCountStatus | "")}>
            <option value="">All</option>
            {(Object.keys(STATUS_LABEL) as StockCountStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {list.data === null ? (
          <p className="muted" style={{ padding: "1.4rem" }}>Loading counts…</p>
        ) : list.items.length === 0 ? (
          <p className="muted" style={{ padding: "1.4rem" }}>No stock counts yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Count</th>
                <th>Location</th>
                <th>Type</th>
                <th>Status</th>
                <th className="num">Counted</th>
                <th className="num">Variance</th>
                <th>Started</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.items.map((c) => (
                <tr key={c.id}>
                  <td>{c.countNumber}</td>
                  <td>{locationName(c.locationCode)}</td>
                  <td>{c.type === "FULL" ? "Full" : "Cycle"}</td>
                  <td>
                    <span className={STATUS_BADGE[c.status]}>{STATUS_LABEL[c.status]}</span>
                  </td>
                  <td className="num">
                    {c.countedLines} / {c.lineCount}
                  </td>
                  <td className="num">
                    {c.varianceValue === null || c.status === "OPEN" ? "—" : formatMoney(c.varianceValue)}
                  </td>
                  <td>
                    {formatDateTime(c.createdAt)}
                    <div className="muted" style={{ fontSize: "0.78rem" }}>{nameOf(c.createdById)}</div>
                  </td>
                  <td>
                    <Link href={`/stock-counts/${c.id}`}>{c.status === "OPEN" ? "Count" : "Open"}</Link>
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

type CycleScope = "suggested" | "category";

function NewCountForm() {
  const router = useRouter();
  const flash = useFlash();
  const [locationCode, setLocationCode] = useState("");
  const [type, setType] = useState<StockCountType>("CYCLE");
  const [scope, setScope] = useState<CycleScope>("suggested");
  const [category, setCategory] = useState("");
  const [suggestions, setSuggestions] = useState<CountSuggestion[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [blind, setBlind] = useState(true);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSuggestions(null);
    if (!locationCode || type !== "CYCLE") return;
    api
      .countSuggestions(locationCode, 20)
      .then((rows) => {
        setSuggestions(rows);
        // Start with the ten most overdue; the counter can change it.
        setPicked(new Set(rows.slice(0, 10).map((r) => r.sku)));
      })
      .catch((err: Error) => setError(err.message));
  }, [locationCode, type]);

  const toggle = (sku: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(sku)) next.delete(sku);
      else next.add(sku);
      return next;
    });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await api.createStockCount({
        locationCode,
        type,
        skus: type === "CYCLE" && scope === "suggested" ? [...picked] : undefined,
        category: type === "CYCLE" && scope === "category" ? category.trim() : undefined,
        blind,
        notes: notes.trim() || undefined,
      });
      flash.success(`${created.countNumber} started — ${created.lines.length} product(s) to count`);
      router.push(`/stock-counts/${created.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  const ready =
    Boolean(locationCode) &&
    (type === "FULL" || (scope === "suggested" ? picked.size > 0 : category.trim().length > 0));

  return (
    <form className="card" onSubmit={submit}>
      <h3 style={{ margin: 0 }}>New stock count</h3>
      <div className="field-row">
        <label>
          Location
          <LocationPicker required value={locationCode} onChange={setLocationCode} />
        </label>
        <label style={{ maxWidth: 260 }}>
          What to count
          <select value={type} onChange={(e) => setType(e.target.value as StockCountType)}>
            <option value="CYCLE">Cycle count — a few products</option>
            <option value="FULL">Full stocktake — everything there</option>
          </select>
        </label>
      </div>

      {type === "CYCLE" && (
        <>
          <div className="actions" role="radiogroup" aria-label="Choose products by">
            <label style={{ flexDirection: "row", alignItems: "center", gap: "0.4rem" }}>
              <input type="radio" checked={scope === "suggested"} onChange={() => setScope("suggested")} />
              Suggested products
            </label>
            <label style={{ flexDirection: "row", alignItems: "center", gap: "0.4rem" }}>
              <input type="radio" checked={scope === "category"} onChange={() => setScope("category")} />
              A whole category
            </label>
          </div>

          {scope === "category" ? (
            <label style={{ maxWidth: 320 }}>
              Category
              <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Sofas" />
            </label>
          ) : !locationCode ? (
            <p className="muted" style={{ margin: 0 }}>Choose a location to see what's due for counting.</p>
          ) : suggestions === null ? (
            <p className="muted" style={{ margin: 0 }}>Finding products due for a count…</p>
          ) : suggestions.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>No stock held at this location.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th />
                  <th>SKU</th>
                  <th>Product</th>
                  <th className="num">On hand</th>
                  <th className="num">Stock value</th>
                  <th>Last counted</th>
                </tr>
              </thead>
              <tbody>
                {suggestions.map((s) => (
                  <tr key={s.sku}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Count ${s.sku}`}
                        checked={picked.has(s.sku)}
                        onChange={() => toggle(s.sku)}
                      />
                    </td>
                    <td>
                      <code>{s.sku}</code>
                    </td>
                    <td>{s.productName}</td>
                    <td className="num">{s.onHand}</td>
                    <td className="num">{formatMoney(s.stockValue)}</td>
                    <td>{s.lastCountedAt ? formatDateTime(s.lastCountedAt) : <span className="badge warn">Never</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      <div className="field-row">
        <label>
          Notes
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Month-end count" />
        </label>
        <label style={{ flexDirection: "row", alignItems: "center", gap: "0.5rem", maxWidth: 320 }}>
          <input type="checkbox" checked={blind} onChange={(e) => setBlind(e.target.checked)} />
          Blind count (counters don't see expected quantities)
        </label>
      </div>

      {error && <p className="error">{error}</p>}
      <div>
        <button className="primary" type="submit" disabled={busy || !ready}>
          {busy ? "Starting…" : "Start count"}
        </button>
      </div>
    </form>
  );
}
