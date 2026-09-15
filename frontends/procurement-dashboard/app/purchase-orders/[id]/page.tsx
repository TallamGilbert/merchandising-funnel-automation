"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { AppShell, type NavSection } from "../../../components/AppShell";
import { BellAlertIcon, ClipboardListIcon } from "../../../components/icons";
import { api, type PurchaseOrder } from "../../../lib/api";

const NAV: NavSection[] = [
  {
    label: "Main menu",
    items: [
      { label: "Purchase orders", href: "/", icon: <ClipboardListIcon /> },
      { label: "Reorder suggestions", href: "/reorder-suggestions", icon: <BellAlertIcon /> },
    ],
  },
];

export default function PurchaseOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setError(null);
    api.getPurchaseOrder(id).then(setPo).catch((err: Error) => setError(err.message));
  };

  useEffect(load, [id]);

  if (error) {
    return (
      <AppShell brandName="Procurement" nav={NAV} title="Purchase order not found">
        <p className="error">{error}</p>
        <Link href="/">&larr; Back to purchase orders</Link>
      </AppShell>
    );
  }

  if (!po) {
    return (
      <AppShell brandName="Procurement" nav={NAV} title="Loading…">
        <p className="muted">Loading…</p>
      </AppShell>
    );
  }

  const run = async (action: () => Promise<PurchaseOrder>) => {
    setBusy(true);
    setActionError(null);
    try {
      await action();
      load();
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell
      brandName="Procurement"
      nav={NAV}
      title={po.poNumber}
      actions={
        <>
          {po.status === "DRAFT" && (
            <button className="primary" disabled={busy} onClick={() => run(() => api.submit(po.id))}>
              Submit for approval
            </button>
          )}
          {po.status === "PENDING_APPROVAL" && (
            <ApproveButton
              busy={busy}
              onApprove={(approvedById, approverRole) =>
                run(() => api.approve(po.id, { approvedById, approverRole }))
              }
            />
          )}
          {po.status === "APPROVED" && (
            <button className="primary" disabled={busy} onClick={() => run(() => api.markSent(po.id))}>
              Mark sent
            </button>
          )}
        </>
      }
    >
      <Link href="/">&larr; Back to purchase orders</Link>

      <div className="row-between" style={{ marginTop: "-0.5rem" }}>
        <span className="badge">{po.status.replaceAll("_", " ")}</span>
      </div>

      {actionError && <p className="error">{actionError}</p>}

      <div className="card">
        <dl style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: "0.5rem 1rem", margin: 0 }}>
          <dt className="muted">Supplier</dt>
          <dd style={{ margin: 0 }}>{po.supplierName}</dd>
          <dt className="muted">Payment terms</dt>
          <dd style={{ margin: 0 }}>Net {po.paymentTermsDays}</dd>
          <dt className="muted">Total</dt>
          <dd style={{ margin: 0 }}>
            {po.currency} {Number(po.totalAmount).toFixed(2)}
          </dd>
          <dt className="muted">Requested by</dt>
          <dd style={{ margin: 0 }}>{po.requestedById}</dd>
          {po.approvedById && (
            <>
              <dt className="muted">Approved by</dt>
              <dd style={{ margin: 0 }}>
                {po.approvedById} on{" "}
                {po.approvedAt ? new Date(po.approvedAt).toLocaleString() : "—"}
              </dd>
            </>
          )}
        </dl>
      </div>

      <section>
        <h2>Lines</h2>
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Product</th>
              <th>Ordered</th>
              <th>Received</th>
              <th>Unit cost</th>
            </tr>
          </thead>
          <tbody>
            {po.lines.map((line) => (
              <tr key={line.id}>
                <td>
                  <code>{line.sku}</code>
                </td>
                <td>{line.productName}</td>
                <td>{line.quantityOrdered}</td>
                <td>{line.quantityReceived}</td>
                <td>
                  {po.currency} {Number(line.unitCost).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}

function ApproveButton({
  busy,
  onApprove,
}: {
  busy: boolean;
  onApprove: (approvedById: string, approverRole: "MANAGER" | "OWNER") => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [approvedById, setApprovedById] = useState("");
  const [approverRole, setApproverRole] = useState<"MANAGER" | "OWNER">("MANAGER");

  if (!showForm) {
    return (
      <button className="primary" onClick={() => setShowForm(true)}>
        Approve
      </button>
    );
  }

  return (
    <form
      style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end" }}
      onSubmit={(e) => {
        e.preventDefault();
        onApprove(approvedById, approverRole);
        setShowForm(false);
      }}
    >
      <label>
        Approver id
        <input
          required
          value={approvedById}
          onChange={(e) => setApprovedById(e.target.value)}
          placeholder="e.g. mgr-sam"
        />
      </label>
      <label>
        Role
        <select
          value={approverRole}
          onChange={(e) => setApproverRole(e.target.value as "MANAGER" | "OWNER")}
        >
          <option value="MANAGER">Manager</option>
          <option value="OWNER">Owner</option>
        </select>
      </label>
      <button className="primary" type="submit" disabled={busy}>
        Confirm
      </button>
      <button type="button" onClick={() => setShowForm(false)}>
        Cancel
      </button>
    </form>
  );
}
