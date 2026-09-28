"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import {
  formatDateTime,
  formatMoney,
  Modal,
  STAFF_ROLE_LABEL,
  StaffPicker,
  type StaffMember,
  useFlash,
  useStaffNames,
} from "@mms/ui";
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
  const flash = useFlash();
  const nameOf = useStaffNames();

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

  const run = async (action: () => Promise<PurchaseOrder>, success: string) => {
    setBusy(true);
    setActionError(null);
    try {
      await action();
      flash.success(success);
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
            <button className="primary" disabled={busy} onClick={() => run(() => api.submit(po.id), `${po.poNumber} submitted for approval`)}>
              Submit for approval
            </button>
          )}
          {po.status === "PENDING_APPROVAL" && (
            <ApproveButton
              busy={busy}
              onApprove={(approvedById, approverRole) =>
                run(() => api.approve(po.id, { approvedById, approverRole }), `${po.poNumber} approved`)
              }
            />
          )}
          {po.status === "APPROVED" && (
            <button className="primary" disabled={busy} onClick={() => run(() => api.markSent(po.id), `${po.poNumber} marked as sent`)}>
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
          <dd style={{ margin: 0 }}>{formatMoney(po.totalAmount, po.currency)}</dd>
          <dt className="muted">Created</dt>
          <dd style={{ margin: 0 }}>{formatDateTime(po.createdAt)}</dd>
          <dt className="muted">Requested by</dt>
          <dd style={{ margin: 0 }}>{nameOf(po.requestedById)}</dd>
          {po.approvedById && (
            <>
              <dt className="muted">Approved by</dt>
              <dd style={{ margin: 0 }}>
                {nameOf(po.approvedById)} on {formatDateTime(po.approvedAt)}
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
              <th className="num">Ordered</th>
              <th className="num">Received</th>
              <th className="num">Unit cost</th>
              <th className="num">Line total</th>
            </tr>
          </thead>
          <tbody>
            {po.lines.map((line) => (
              <tr key={line.id}>
                <td>
                  <code>{line.sku}</code>
                </td>
                <td>{line.productName}</td>
                <td className="num">{line.quantityOrdered}</td>
                <td className="num">{line.quantityReceived}</td>
                <td className="num">{formatMoney(line.unitCost, po.currency)}</td>
                <td className="num">{formatMoney(Number(line.unitCost) * line.quantityOrdered, po.currency)}</td>
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
  const [open, setOpen] = useState(false);
  const [approvedById, setApprovedById] = useState("");
  const [approver, setApprover] = useState<StaffMember | null>(null);
  // Only managers and owners are offered, so the role always fits D-1.
  const approverRole = approver?.role === "OWNER" ? "OWNER" : "MANAGER";

  const close = () => {
    setOpen(false);
    setApprovedById("");
    setApprover(null);
  };

  return (
    <>
      <button className="primary" onClick={() => setOpen(true)}>
        Approve
      </button>
      <Modal open={open} title="Approve purchase order" onClose={close}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onApprove(approvedById, approverRole);
            close();
          }}
        >
          <label>
            Approver
            <StaffPicker
              required
              roles={["MANAGER", "OWNER"]}
              value={approvedById}
              onChange={setApprovedById}
              onSelectMember={setApprover}
            />
          </label>
          <p className="muted" style={{ margin: 0 }}>
            {approver
              ? `Approving as ${STAFF_ROLE_LABEL[approver.role]}. Managers can approve orders below the approval limit; larger orders need an owner.`
              : "Pick who is approving — their role comes from the staff directory."}
          </p>
          <div className="mms-modal-footer">
            <button type="button" onClick={close}>
              Cancel
            </button>
            <button className="primary" type="submit" disabled={busy || !approvedById}>
              Approve
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
