"use client";

import { useMemo, useState } from "react";
import {
  directoryApi,
  formatDateTime,
  LocationPicker,
  Modal,
  STAFF_ROLE_LABEL,
  type StaffMember,
  type StaffRole,
  useCurrentUser,
  useFlash,
  useLocations,
  useStaff,
} from "@mms/ui";
import { AppShell } from "../../components/AppShell";
import { NAV } from "../../lib/nav";

const ROLES = Object.keys(STAFF_ROLE_LABEL) as StaffRole[];

const ROLE_HINT: Record<StaffRole, string> = {
  OWNER: "Everything, including approving purchase orders at or above the approval limit and managing managers.",
  MANAGER: "Approves smaller purchase orders, closes stores, requests transfers, manages cashiers and warehouse staff.",
  BUYER: "Manages suppliers and raises purchase orders for a manager to approve.",
  ACCOUNTANT: "Works in the Finance Portal: payables, ledger and reports.",
  CASHIER: "Rings up sales and returns at a store's registers.",
  WAREHOUSE_STAFF: "Receives deliveries, puts stock away and picks transfers.",
};

/** Mirrors Directory's rule (D-17): managers manage cashiers and warehouse staff, owners manage everyone. */
function manageableRoles(role: StaffRole): StaffRole[] {
  if (role === "OWNER") return ROLES;
  if (role === "MANAGER") return ["CASHIER", "WAREHOUSE_STAFF"];
  return [];
}

export default function StaffPage() {
  const flash = useFlash();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<StaffRole | "">("");
  const [showInactive, setShowInactive] = useState(false);
  const [changingRole, setChangingRole] = useState<StaffMember | null>(null);
  const [adding, setAdding] = useState(false);
  const [handover, setHandover] = useState<{ name: string; id: string; password: string } | null>(null);
  const me = useCurrentUser();
  const canManage = manageableRoles(me.role);
  const { data: staff, loading, error, reload } = useStaff({ includeInactive: true });
  const { data: locations } = useLocations();
  const locationName = (code: string | null) =>
    code ? (locations.find((l) => l.code === code)?.name ?? code) : "All locations";

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return staff.filter(
      (s) =>
        (showInactive || s.active) &&
        (!roleFilter || s.role === roleFilter) &&
        (!q || s.name.toLowerCase().includes(q) || s.id.includes(q)),
    );
  }, [staff, search, roleFilter, showInactive]);

  const toggleActive = async (member: StaffMember) => {
    try {
      await directoryApi.updateStaff(member.id, { active: !member.active });
      flash.success(`${member.name} ${member.active ? "deactivated" : "reactivated"}`);
      reload();
    } catch (err) {
      flash.error((err as Error).message);
    }
  };

  const resetPassword = async (member: StaffMember) => {
    if (!window.confirm(`Reset ${member.name}'s password? They'll be signed out everywhere.`)) return;
    try {
      const { temporaryPassword } = await directoryApi.resetPassword(member.id);
      setHandover({ name: member.name, id: member.id, password: temporaryPassword });
      reload();
    } catch (err) {
      flash.error((err as Error).message);
    }
  };

  return (
    <AppShell
      brandName="Store Manager"
      nav={NAV}
      title="Staff"
      subtitle="Who works where, what they're allowed to do, and their sign-in. Every picker across MMS reads from this list."
      search={{ value: search, onChange: setSearch, placeholder: "Search staff…" }}
      actions={
        canManage.length > 0 && (
          <button className="primary" onClick={() => setAdding(true)}>
            Add staff member
          </button>
        )
      }
    >
      <div className="row-between">
        <label style={{ maxWidth: 220 }}>
          Role
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as StaffRole | "")}>
            <option value="">All roles</option>
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {STAFF_ROLE_LABEL[role]}
              </option>
            ))}
          </select>
        </label>
        <label style={{ flexDirection: "row", alignItems: "center", gap: "0.5rem" }}>
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Show inactive
        </label>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="card" style={{ padding: 0 }}>
        {loading && staff.length === 0 ? (
          <p className="muted" style={{ padding: "1.4rem" }}>Loading staff…</p>
        ) : visible.length === 0 ? (
          <p className="muted" style={{ padding: "1.4rem" }}>No staff match.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Works at</th>
                <th>Last sign-in</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((member) => (
                <tr key={member.id} style={member.active ? undefined : { opacity: 0.55 }}>
                  <td>
                    {member.name}
                    <div className="muted" style={{ fontSize: "0.78rem" }}>{member.id}</div>
                  </td>
                  <td>
                    <span className="badge">{STAFF_ROLE_LABEL[member.role]}</span>
                    {!member.active && <span className="badge warn" style={{ marginLeft: 6 }}>Inactive</span>}
                    {member.active && member.mustChangePassword && (
                      <span className="badge warn" style={{ marginLeft: 6 }}>Temporary password</span>
                    )}
                  </td>
                  <td>{locationName(member.locationCode)}</td>
                  <td>{member.lastLoginAt ? formatDateTime(member.lastLoginAt) : <span className="muted">Never</span>}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {member.id !== me.id && canManage.includes(member.role) && (
                      <>
                        <button onClick={() => setChangingRole(member)} disabled={!member.active}>
                          Change role
                        </button>{" "}
                        <button onClick={() => resetPassword(member)} disabled={!member.active}>
                          Reset password
                        </button>{" "}
                        <button onClick={() => toggleActive(member)}>{member.active ? "Deactivate" : "Reactivate"}</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {changingRole && (
        <ChangeRoleModal
          member={changingRole}
          roles={canManage}
          onClose={() => setChangingRole(null)}
          onSaved={(updated) => {
            setChangingRole(null);
            flash.success(`${updated.name} is now ${STAFF_ROLE_LABEL[updated.role].toLowerCase()} at ${locationName(updated.locationCode)}`);
            reload();
          }}
        />
      )}

      {adding && (
        <AddStaffModal
          roles={canManage}
          onClose={() => setAdding(false)}
          onSaved={(created) => {
            setAdding(false);
            flash.success(`${created.name} added as ${STAFF_ROLE_LABEL[created.role].toLowerCase()}`);
            setHandover({ name: created.name, id: created.id, password: created.temporaryPassword });
            reload();
          }}
        />
      )}

      {handover && <TemporaryPasswordModal {...handover} onClose={() => setHandover(null)} />}
    </AppShell>
  );
}

function RoleChoices({
  value,
  roles,
  onChange,
}: {
  value: StaffRole;
  roles: StaffRole[];
  onChange: (role: StaffRole) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {roles.map((role) => (
        <label
          key={role}
          className="card"
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            gap: "0.6rem",
            padding: "0.7rem 0.8rem",
            cursor: "pointer",
            borderColor: value === role ? "var(--accent)" : undefined,
            background: value === role ? "var(--accent-soft)" : undefined,
          }}
        >
          <input type="radio" name="role" checked={value === role} onChange={() => onChange(role)} />
          <span>
            <strong style={{ color: "var(--text)" }}>{STAFF_ROLE_LABEL[role]}</strong>
            <br />
            {ROLE_HINT[role]}
          </span>
        </label>
      ))}
    </div>
  );
}

function ChangeRoleModal({
  member,
  roles,
  onClose,
  onSaved,
}: {
  member: StaffMember;
  roles: StaffRole[];
  onClose: () => void;
  onSaved: (updated: StaffMember) => void;
}) {
  const [role, setRole] = useState<StaffRole>(member.role);
  const [locationCode, setLocationCode] = useState(member.locationCode ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const unchanged = role === member.role && locationCode === (member.locationCode ?? "");

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onSaved(await directoryApi.updateStaff(member.id, { role, locationCode: locationCode || null }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open title={`Change role — ${member.name}`} onClose={onClose}>
      <form onSubmit={save}>
        <RoleChoices value={role} roles={roles} onChange={setRole} />
        <label>
          Works at
          <LocationPicker clearable value={locationCode} onChange={setLocationCode} placeholder="All locations" />
        </label>
        {role !== member.role && (
          <p className="muted" style={{ margin: 0 }}>{member.name} will be signed out and sign in again with the new role.</p>
        )}
        {error && <p className="error">{error}</p>}
        <div className="mms-modal-footer">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" type="submit" disabled={busy || unchanged}>
            {busy ? "Saving…" : "Save role"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function AddStaffModal({
  roles,
  onClose,
  onSaved,
}: {
  roles: StaffRole[];
  onClose: () => void;
  onSaved: (created: StaffMember & { temporaryPassword: string }) => void;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<StaffRole>("CASHIER");
  const [locationCode, setLocationCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // The id other modules record — generated so nobody has to invent one.
  const prefix: Record<StaffRole, string> = {
    OWNER: "owner",
    MANAGER: "mgr",
    BUYER: "buyer",
    ACCOUNTANT: "acct",
    CASHIER: "cashier",
    WAREHOUSE_STAFF: "wh",
  };
  const firstName = slugify(name).split("-")[0];
  const id = firstName ? `${prefix[role]}-${firstName}` : "";

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onSaved(await directoryApi.createStaff({ id, name: name.trim(), role, locationCode: locationCode || undefined }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open title="Add staff member" onClose={onClose}>
      <form onSubmit={save}>
        <label>
          Full name
          <input required autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <RoleChoices value={role} roles={roles} onChange={setRole} />
        <label>
          Works at
          <LocationPicker clearable value={locationCode} onChange={setLocationCode} placeholder="All locations" />
        </label>
        {id && (
          <p className="muted" style={{ margin: 0 }}>
            Staff id (what they sign in with): <code>{id}</code>
          </p>
        )}
        {error && <p className="error">{error}</p>}
        <div className="mms-modal-footer">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" type="submit" disabled={busy || !id}>
            {busy ? "Adding…" : "Add staff member"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Shown once: Directory never returns this password again. */
function TemporaryPasswordModal({
  name,
  id,
  password,
  onClose,
}: {
  name: string;
  id: string;
  password: string;
  onClose: () => void;
}) {
  return (
    <Modal open title={`Sign-in for ${name}`} onClose={onClose}>
      <p style={{ margin: 0 }}>
        Give {name} these details. They&apos;ll choose their own password the first time they sign in.
      </p>
      <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "0.4rem 1rem", margin: 0 }}>
        <dt className="muted">Staff ID</dt>
        <dd style={{ margin: 0 }}>
          <code>{id}</code>
        </dd>
        <dt className="muted">Temporary password</dt>
        <dd style={{ margin: 0 }}>
          <code style={{ fontSize: "1.15rem", letterSpacing: "0.05em" }}>{password}</code>
        </dd>
      </dl>
      <p className="muted" style={{ margin: 0 }}>This password won&apos;t be shown again — reset it if it gets lost.</p>
      <div className="mms-modal-footer">
        <button className="primary" type="button" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}
