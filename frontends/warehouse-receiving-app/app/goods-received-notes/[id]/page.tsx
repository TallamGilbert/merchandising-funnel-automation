"use client";

import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import { AppShell, type NavSection } from "../../../components/AppShell";
import { ClipboardListIcon, PackageIcon } from "../../../components/icons";
import {
  api,
  type GoodsReceivedNote,
  type GoodsReceivedNoteCondition,
  type GoodsReceivedNoteDiscrepancyType,
} from "../../../lib/api";

const NAV: NavSection[] = [
  {
    label: "Main menu",
    items: [
      { label: "Expected deliveries", href: "/", icon: <PackageIcon /> },
      { label: "Goods received notes", href: "/goods-received-notes", icon: <ClipboardListIcon /> },
    ],
  },
];

const DISCREPANCY_BADGE: Record<GoodsReceivedNoteDiscrepancyType, string> = {
  NONE: "badge ok",
  SHORTAGE: "badge warn",
  OVERAGE: "badge warn",
  DAMAGE: "badge danger",
};

/** FR-3.3 — plain-language flag shown straight after a scan. */
function describeScan(goodsReceivedNote: GoodsReceivedNote, sku: string): string {
  const lines = goodsReceivedNote.lines.filter((l) => l.sku === sku);
  const good = lines.find((l) => l.condition === "GOOD");
  const damaged = lines.find((l) => l.condition === "DAMAGED");
  const arrived = lines.reduce((sum, l) => sum + l.quantityReceived, 0);
  const parts: string[] = [];

  if (!good) parts.push("not on this PO");
  else if (good.discrepancyType === "SHORTAGE")
    parts.push(`${good.quantityOrdered - arrived} still to come`);
  else if (good.discrepancyType === "OVERAGE")
    parts.push(`${arrived - good.quantityOrdered} over the order`);
  else parts.push("matches the order");

  if (damaged && damaged.quantityReceived > 0)
    parts.push(`${damaged.quantityReceived} damaged and quarantined`);
  return parts.join(" · ");
}

export default function GoodsReceivedNotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [goodsReceivedNote, setGoodsReceivedNote] = useState<GoodsReceivedNote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastScan, setLastScan] = useState<string | null>(null);

  const [sku, setSku] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [condition, setCondition] = useState<GoodsReceivedNoteCondition>("GOOD");
  const [confirmingFinalize, setConfirmingFinalize] = useState(false);
  const skuInput = useRef<HTMLInputElement>(null);

  const load = () => {
    setError(null);
    api.getGoodsReceivedNote(id).then(setGoodsReceivedNote).catch((err: Error) => setError(err.message));
  };

  useEffect(load, [id]);

  if (error) {
    return (
      <AppShell brandName="Receiving" nav={NAV} title="GRN not found">
        <p className="error">{error}</p>
        <Link href="/goods-received-notes">&larr; Back to GRNs</Link>
      </AppShell>
    );
  }

  if (!goodsReceivedNote) {
    return (
      <AppShell brandName="Receiving" nav={NAV} title="Loading…">
        <p className="muted">Loading…</p>
      </AppShell>
    );
  }

  const isDraft = goodsReceivedNote.status === "DRAFT";
  const flagged = goodsReceivedNote.lines.filter((l) => l.discrepancyType !== "NONE");
  const anyScanned = goodsReceivedNote.lines.some((l) => l.quantityReceived > 0);

  // Barcode scanners type the code then press Enter, so submitting the form
  // is the whole scan gesture: the field is cleared and refocused for the next item.
  const scan = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = sku.trim();
    if (!code) return;
    setBusy(true);
    setActionError(null);
    try {
      const updated = await api.recordScan(goodsReceivedNote.id, { sku: code, quantity, condition });
      setGoodsReceivedNote(updated);
      setLastScan(
        `${quantity} × ${code} (${condition === "GOOD" ? "good" : "damaged"}) — ${describeScan(updated, code)}`,
      );
      setSku("");
      setQuantity(1);
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setBusy(false);
      skuInput.current?.focus();
    }
  };

  const finalize = async () => {
    setBusy(true);
    setActionError(null);
    try {
      setGoodsReceivedNote(await api.finalizeGoodsReceivedNote(goodsReceivedNote.id));
      setConfirmingFinalize(false);
      setLastScan(null);
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell
      brandName="Receiving"
      nav={NAV}
      title={goodsReceivedNote.goodsReceivedNoteNumber}
      actions={
        isDraft &&
        (confirmingFinalize ? (
          <>
            <button className="primary" disabled={busy} onClick={finalize}>
              Confirm finalize
            </button>
            <button onClick={() => setConfirmingFinalize(false)}>Cancel</button>
          </>
        ) : (
          <button
            className="primary"
            disabled={busy || !anyScanned}
            onClick={() => setConfirmingFinalize(true)}
          >
            Finalize GRN
          </button>
        ))
      }
    >
      <Link href="/goods-received-notes">&larr; Back to GRNs</Link>

      <div className="row-between" style={{ marginTop: "-0.5rem" }}>
        <span className={`badge${goodsReceivedNote.status === "FINALIZED" ? " ok" : ""}`}>{goodsReceivedNote.status}</span>
      </div>

      {confirmingFinalize && (
        <p className="card">
          Finalizing locks this GRN and tells Inventory and Warehouse Operations the goods have
          arrived.{" "}
          {flagged.length > 0
            ? `${flagged.length} line${flagged.length === 1 ? " has" : "s have"} a flagged discrepancy.`
            : "No discrepancies are flagged."}
        </p>
      )}

      {actionError && <p className="error">{actionError}</p>}

      <div className="card">
        <dl style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: "0.5rem 1rem", margin: 0 }}>
          <dt className="muted">Purchase order</dt>
          <dd style={{ margin: 0 }}>{goodsReceivedNote.poNumber}</dd>
          <dt className="muted">Dock location</dt>
          <dd style={{ margin: 0 }}>{goodsReceivedNote.receivedAtLocation}</dd>
          <dt className="muted">Received by</dt>
          <dd style={{ margin: 0 }}>{goodsReceivedNote.receivedById}</dd>
          {goodsReceivedNote.finalizedAt && (
            <>
              <dt className="muted">Finalized</dt>
              <dd style={{ margin: 0 }}>{new Date(goodsReceivedNote.finalizedAt).toLocaleString()}</dd>
            </>
          )}
        </dl>
      </div>

      {isDraft && (
        <form className="card" onSubmit={scan}>
          <h3 style={{ margin: 0 }}>Scan an item</h3>
          <div className="field-row">
            <label style={{ flex: 3 }}>
              Barcode / SKU
              <input
                ref={skuInput}
                autoFocus
                required
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="Scan or type a SKU, then Enter"
                style={{ fontSize: "1.15rem", padding: "0.8rem 0.9rem" }}
                autoComplete="off"
                inputMode="text"
              />
            </label>
            <label style={{ maxWidth: 140 }}>
              Quantity
              <input
                required
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                style={{ fontSize: "1.15rem", padding: "0.8rem 0.9rem" }}
                inputMode="numeric"
              />
            </label>
          </div>
          <div className="actions">
            <button
              type="button"
              className={condition === "GOOD" ? "primary" : undefined}
              onClick={() => setCondition("GOOD")}
              style={{ padding: "0.75rem 1.5rem" }}
            >
              Good
            </button>
            <button
              type="button"
              className={condition === "DAMAGED" ? "danger" : undefined}
              onClick={() => setCondition("DAMAGED")}
              style={{ padding: "0.75rem 1.5rem" }}
            >
              Damaged (quarantine)
            </button>
          </div>
          <div>
            <button className="primary" type="submit" disabled={busy} style={{ padding: "0.75rem 1.5rem" }}>
              {busy ? "Recording…" : "Record scan"}
            </button>
          </div>
          {lastScan && <p className="muted" style={{ margin: 0 }}>Last scan: {lastScan}</p>}
        </form>
      )}

      <section>
        <h2>Lines</h2>
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Product</th>
              <th>Condition</th>
              <th>Ordered</th>
              <th>Received</th>
              <th>Flag</th>
            </tr>
          </thead>
          <tbody>
            {goodsReceivedNote.lines.map((line) => (
              <tr key={line.id}>
                <td>
                  <code>{line.sku}</code>
                </td>
                <td>{line.productName}</td>
                <td>
                  <span className={line.condition === "DAMAGED" ? "badge danger" : "badge"}>
                    {line.quarantined ? "Quarantined" : "Good"}
                  </span>
                </td>
                <td>{line.condition === "GOOD" ? line.quantityOrdered : "—"}</td>
                <td>{line.quantityReceived}</td>
                <td>
                  {line.discrepancyType === "NONE" ? (
                    <span className="muted">—</span>
                  ) : (
                    <span className={DISCREPANCY_BADGE[line.discrepancyType]}>
                      {line.discrepancyType}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}
