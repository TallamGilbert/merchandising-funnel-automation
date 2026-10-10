"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useRef, useState } from "react";
import {
  formatDateTime,
  formatMoney,
  Modal,
  useCurrentUser,
  useFlash,
  useLocations,
  usePolling,
  useStaffNames,
} from "@mms/ui";
import { AppShell } from "../../../components/AppShell";
import { api, type StockCountDetail, type UncountedHandling } from "../../../lib/api";
import { NAV } from "../../../lib/nav";
import { canCount, canManageCounts, STATUS_BADGE, STATUS_LABEL } from "../../../lib/stock-counts";

type LineFilter = "all" | "uncounted" | "variance";

export default function StockCountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const user = useCurrentUser();
  const flash = useFlash();
  const nameOf = useStaffNames();
  const { data: locations } = useLocations();
  const [count, setCount] = useState<StockCountDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<LineFilter>("all");
  const [submitting, setSubmitting] = useState(false);
  const [posting, setPosting] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = () => {
    api
      .getStockCount(id)
      .then((c) => {
        setCount(c);
        setError(null);
      })
      .catch((err: Error) => setError(err.message));
  };
  useEffect(load, [id]);
  // Several people may count the same location at once.
  usePolling(load, 10000, count?.status === "OPEN");

  const lines = useMemo(() => {
    const all = count?.lines ?? [];
    if (filter === "uncounted") return all.filter((l) => l.countedQty === null);
    if (filter === "variance") return all.filter((l) => l.variance !== null && l.variance !== 0);
    return all;
  }, [count, filter]);

  if (error && !count) {
    return (
      <AppShell brandName="Inventory" nav={NAV} title="Stock count">
        <p className="error">{error}</p>
        <Link href="/stock-counts">&larr; Back to stock counts</Link>
      </AppShell>
    );
  }
  if (!count) {
    return (
      <AppShell brandName="Inventory" nav={NAV} title="Stock count">
        <p className="muted">Loading…</p>
      </AppShell>
    );
  }

  const location = locations.find((l) => l.code === count.locationCode)?.name ?? count.locationCode;
  const counting = count.status === "OPEN" && canCount(user.role);
  const manager = canManageCounts(user.role);

  const act = async (action: () => Promise<StockCountDetail>, message: string) => {
    setBusy(true);
    try {
      setCount(await action());
      flash.success(message);
    } catch (err) {
      flash.error((err as Error).message);
      load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell
      brandName="Inventory"
      nav={NAV}
      title={`${count.countNumber} — ${location}`}
      subtitle={`${count.type === "FULL" ? "Full stocktake" : "Cycle count"}${count.blind ? " · blind" : ""}${
        count.notes ? ` · ${count.notes}` : ""
      }`}
      actions={
        <>
          {count.status === "OPEN" && canCount(user.role) && (
            <button className="primary" disabled={busy} onClick={() => setSubmitting(true)}>
              Finish counting
            </button>
          )}
          {count.status === "SUBMITTED" && manager && (
            <button className="primary" disabled={busy} onClick={() => setPosting(true)}>
              Review and post
            </button>
          )}
          {(count.status === "OPEN" || count.status === "SUBMITTED") && manager && (
            <button
              className="danger"
              disabled={busy}
              onClick={() => {
                if (window.confirm(`Cancel ${count.countNumber}? Nothing will be adjusted.`)) {
                  void act(() => api.cancelStockCount(count.id), `${count.countNumber} cancelled`);
                }
              }}
            >
              Cancel count
            </button>
          )}
        </>
      }
    >
      <Link href="/stock-counts">&larr; Back to stock counts</Link>

      <div className="mms-chart-grid">
        <div className="stat-card">
          <span className="muted">Status</span>
          <p className="stat-value">
            <span className={STATUS_BADGE[count.status]}>{STATUS_LABEL[count.status]}</span>
          </p>
          <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>
            Started by {nameOf(count.createdById)}, {formatDateTime(count.createdAt)}
            {count.submittedById && <> · submitted by {nameOf(count.submittedById)}</>}
            {count.postedById && <> · posted by {nameOf(count.postedById)}, {formatDateTime(count.postedAt)}</>}
          </p>
        </div>
        <div className="stat-card">
          <span className="muted">Counted</span>
          <p className="stat-value">
            {count.countedLines} / {count.lineCount}
          </p>
          <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>products</p>
        </div>
        <div className="stat-card">
          <span className="muted">Variance</span>
          {count.varianceValue === null ? (
            <>
              <p className="stat-value">Hidden</p>
              <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>Blind count — shown once submitted</p>
            </>
          ) : (
            <>
              <p className="stat-value">{formatMoney(count.varianceValue)}</p>
              <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>
                {count.unitsShort} unit(s) short · {count.unitsOver} over · {count.linesWithVariance} line(s)
              </p>
            </>
          )}
        </div>
      </div>

      {count.status === "POSTED" && (
        <p className="card" style={{ margin: 0 }}>
          Posted: every variance was applied to stock at {location} and booked to the ledger as inventory shrinkage.
        </p>
      )}

      {counting && <CountEntry count={count} onRecorded={setCount} />}

      <div className="row-between">
        <label style={{ maxWidth: 220 }}>
          Show
          <select value={filter} onChange={(e) => setFilter(e.target.value as LineFilter)}>
            <option value="all">Every line</option>
            <option value="uncounted">Not counted yet</option>
            {!count.expectedHidden && <option value="variance">Variances only</option>}
          </select>
        </label>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {lines.length === 0 ? (
          <p className="muted" style={{ padding: "1.4rem" }}>Nothing to show.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Product</th>
                <th className="num">Expected</th>
                <th className="num">Counted</th>
                <th className="num">Variance</th>
                <th className="num">Value</th>
                <th>Counted by</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id}>
                  <td>
                    <code>{line.sku}</code>
                  </td>
                  <td>{line.productName}</td>
                  <td className="num">{line.expectedQty ?? <span className="muted">hidden</span>}</td>
                  <td className="num">{line.countedQty ?? <span className="muted">—</span>}</td>
                  <td className="num">
                    {line.variance === null ? (
                      ""
                    ) : (
                      <span className={line.variance < 0 ? "badge danger" : line.variance > 0 ? "badge warn" : "muted"}>
                        {line.variance > 0 ? `+${line.variance}` : line.variance}
                      </span>
                    )}
                  </td>
                  <td className="num">
                    {line.variance ? formatMoney(line.variance * Number(line.unitCost)) : ""}
                  </td>
                  <td className="muted">{line.countedById ? nameOf(line.countedById) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {submitting && (
        <SubmitModal
          uncounted={count.lineCount - count.countedLines}
          busy={busy}
          onClose={() => setSubmitting(false)}
          onSubmit={(uncounted) => {
            setSubmitting(false);
            void act(() => api.submitStockCount(count.id, uncounted), `${count.countNumber} submitted for review`);
          }}
        />
      )}

      {posting && (
        <Modal open title={`Post ${count.countNumber}?`} onClose={() => setPosting(false)}>
          <p style={{ margin: 0 }}>
            This adjusts stock at {location} for {count.linesWithVariance} product(s) — {count.unitsShort} unit(s)
            short and {count.unitsOver} over, worth {formatMoney(count.varianceValue ?? 0)} — and books it to the
            ledger. It can&apos;t be undone; a mistake needs another count.
          </p>
          <div className="mms-modal-footer">
            <button type="button" onClick={() => setPosting(false)}>
              Not yet
            </button>
            <button
              className="primary"
              type="button"
              disabled={busy}
              onClick={() => {
                setPosting(false);
                void act(() => api.postStockCount(count.id), `${count.countNumber} posted`);
              }}
            >
              Post count
            </button>
          </div>
        </Modal>
      )}
    </AppShell>
  );
}

/** Scan or type a SKU, then the quantity found; Enter moves on. A repeat entry replaces the earlier one. */
function CountEntry({ count, onRecorded }: { count: StockCountDetail; onRecorded: (c: StockCountDetail) => void }) {
  const flash = useFlash();
  const [sku, setSku] = useState("");
  const [qty, setQty] = useState("");
  const [busy, setBusy] = useState(false);
  const skuRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = sku.trim();
    if (!code || qty === "") return;
    setBusy(true);
    try {
      onRecorded(await api.recordCount(count.id, code, Number(qty)));
      flash.success(`${code}: ${qty} counted`);
      setSku("");
      setQty("");
      skuRef.current?.focus();
    } catch (err) {
      flash.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card" onSubmit={save}>
      <h3 style={{ margin: 0 }}>Record a count</h3>
      <div className="field-row">
        <label>
          SKU — scan or type
          <input
            ref={skuRef}
            autoFocus
            autoComplete="off"
            value={sku}
            list="count-skus"
            onChange={(e) => setSku(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                qtyRef.current?.focus();
              }
            }}
            style={{ fontSize: "1.1rem" }}
          />
          <datalist id="count-skus">
            {count.lines.map((l) => (
              <option key={l.sku} value={l.sku}>
                {l.productName}
              </option>
            ))}
          </datalist>
        </label>
        <label style={{ maxWidth: 160 }}>
          Quantity found
          <input
            ref={qtyRef}
            type="number"
            min={0}
            step={1}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            style={{ fontSize: "1.1rem" }}
          />
        </label>
      </div>
      <div>
        <button className="primary" type="submit" disabled={busy || !sku.trim() || qty === ""}>
          {busy ? "Saving…" : "Save count"}
        </button>
      </div>
    </form>
  );
}

function SubmitModal({
  uncounted,
  busy,
  onClose,
  onSubmit,
}: {
  uncounted: number;
  busy: boolean;
  onClose: () => void;
  onSubmit: (uncounted: UncountedHandling) => void;
}) {
  const [handling, setHandling] = useState<UncountedHandling>("skip");
  return (
    <Modal open title="Finish counting" onClose={onClose}>
      {uncounted === 0 ? (
        <p style={{ margin: 0 }}>Every line is counted. A manager will review the variances and post the count.</p>
      ) : (
        <>
          <p style={{ margin: 0 }}>{uncounted} line(s) haven&apos;t been counted. What should happen to them?</p>
          <label style={{ flexDirection: "row", alignItems: "center", gap: "0.5rem" }}>
            <input type="radio" checked={handling === "skip"} onChange={() => setHandling("skip")} />
            Leave them out — their stock stays as it is
          </label>
          <label style={{ flexDirection: "row", alignItems: "center", gap: "0.5rem" }}>
            <input type="radio" checked={handling === "zero"} onChange={() => setHandling("zero")} />
            None were found — record them as 0
          </label>
        </>
      )}
      <div className="mms-modal-footer">
        <button type="button" onClick={onClose}>
          Keep counting
        </button>
        <button className="primary" type="button" disabled={busy} onClick={() => onSubmit(uncounted ? handling : "reject")}>
          Submit for review
        </button>
      </div>
    </Modal>
  );
}
