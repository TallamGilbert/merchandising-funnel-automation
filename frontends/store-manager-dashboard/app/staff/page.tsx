"use client";

import { useMemo, useState } from "react";
import {
  directoryApi,
  formatDate,
  LocationPicker,
  Modal,
  STAFF_ROLE_LABEL,
  type StaffMember,
  type StaffRole,
  useFlash,
  useLocations,
  useStaff,
} from "@mms/ui";
import { AppShell } from "../../components/AppShell";
import { NAV } from "../../lib/nav";

const ROLES = Object.keys(STAFF_ROLE_LABEL) as StaffRole[];

const ROLE_HINT: Record<StaffRole, string> = {
  OWNER: "Approves purchase orders at or above the approval limit.",
  MANAGER: "Approves smaller purchase orders, closes stores, requests transfers.",
  CASHIER: "Rings up sales and returns at a store's registers.",
  WAREHOUSE_STAFF: "Receives deliveries, puts stock away and picks transfers.",
};

export default function StaffPage() {
  const flash = useFlash();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<StaffRole | "">("");
  const [showInactive, setShowInactive] = useState(false);
  const [changingRole, setChangingRole] = useState<StaffMember | null>(null);
  const [adding, setAdding] = useState(false);
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

  return (
    <AppShell
      brandName="Store Manager"
      nav={NAV}
      title="Staff"
      subtitle="Who works where, and what they're allowed to do. Every picker across MMS reads from this list."
      search={{ value: search, onChange: setSearch, placeholder: "Search staff…" }}
      actions={
        <button className="primary" onClick={() => setAdding(true)}>
          Add staff member
        </button>
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
                <th>Since</th>
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
                  </td>
                  <td>{locationName(member.locationCode)}</td>
                  <td>{formatDate(member.createdAt)}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button onClick={() => setChangingRole(member)} disabled={!member.active}>
                      Change role
                    </button>{" "}
                    <button onClick={() => toggleActive(member)}>{member.active ? "Deactivate" : "Reactivate"}</button>
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
          onClose={() => setAdding(false)}
          onSaved={(created) => {
            setAdding(false);
            flash.success(`${created.name} added as ${STAFF_ROLE_LABEL[created.role].toLowerCase()}`);
            reload();
          }}
        />
      )}
    </AppShell>
  );
}

function RoleChoices({ value, onChange }: { value: StaffRole; onChange: (role: StaffRole) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {ROLES.map((role) => (
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
  onClose,
  onSaved,
}: {
  member: StaffMember;
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
        <RoleChoices value={role} onChange={setRole} />
        <label>
          Works at
          <LocationPicker clearable value={locationCode} onChange={setLocationCode} placeholder="All locations" />
        </label>
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

function AddStaffModal({ onClose, onSaved }: { onClose: () => void; onSaved: (created: StaffMember) => void }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<StaffRole>("CASHIER");
  const [locationCode, setLocationCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // The id other modules record — generated so nobody has to invent one.
  const prefix: Record<StaffRole, string> = { OWNER: "owner", MANAGER: "mgr", CASHIER: "cashier", WAREHOUSE_STAFF: "wh" };
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
        <RoleChoices value={role} onChange={setRole} />
        <label>
          Works at
          <LocationPicker clearable value={locationCode} onChange={setLocationCode} placeholder="All locations" />
        </label>
        {id && (
          <p className="muted" style={{ margin: 0 }}>
            Staff id: <code>{id}</code>
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
