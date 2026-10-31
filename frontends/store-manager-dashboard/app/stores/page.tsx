"use client";

import { useEffect, useMemo, useState } from "react";
import {
  codeError,
  type DeactivationCheck,
  directoryApi,
  type DirectoryLocation,
  type LocationType,
  Modal,
  nextRegisterCode,
  normalizeCode,
  useFlash,
  useLocations,
} from "@mms/ui";
import { AppShell } from "../../components/AppShell";
import { NAV } from "../../lib/nav";

const TYPE_LABEL: Record<LocationType, string> = { STORE: "Store", WAREHOUSE: "Warehouse" };

const TYPE_HINT: Record<LocationType, string> = {
  STORE: "Sells to customers at its registers (tills) and is closed out at the end of each day.",
  WAREHOUSE: "Receives deliveries and holds stock that is transferred out to stores. Has no registers.",
};

export default function StoresPage() {
  const flash = useFlash();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<LocationType | "">("");
  const [showInactive, setShowInactive] = useState(false);
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState<DirectoryLocation | null>(null);
  const [addingRegisterTo, setAddingRegisterTo] = useState<DirectoryLocation | null>(null);
  const [toggling, setToggling] = useState<DirectoryLocation | null>(null);
  const { data: locations, loading, error, reload } = useLocations(undefined, true);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return locations.filter(
      (l) =>
        (showInactive || l.active) &&
        (!typeFilter || l.type === typeFilter) &&
        (!q || l.name.toLowerCase().includes(q) || l.code.toLowerCase().includes(q)),
    );
  }, [locations, search, typeFilter, showInactive]);

  return (
    <AppShell
      brandName="Store Manager"
      nav={NAV}
      title="Stores"
      subtitle="Stores, warehouses and the registers in each store. Every location picker across MMS reads from this list."
      search={{ value: search, onChange: setSearch, placeholder: "Search locations…" }}
      actions={
        <button className="primary" onClick={() => setAdding(true)}>
          Add location
        </button>
      }
    >
      <div className="row-between">
        <label style={{ maxWidth: 220 }}>
          Type
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as LocationType | "")}>
            <option value="">Stores and warehouses</option>
            {(Object.keys(TYPE_LABEL) as LocationType[]).map((type) => (
              <option key={type} value={type}>
                {TYPE_LABEL[type]}s
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
        {loading && locations.length === 0 ? (
          <p className="muted" style={{ padding: "1.4rem" }}>Loading locations…</p>
        ) : visible.length === 0 ? (
          <p className="muted" style={{ padding: "1.4rem" }}>No locations match.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Registers</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((location) => (
                <tr key={location.code} style={location.active ? undefined : { opacity: 0.55 }}>
                  <td>
                    {location.name}
                    <div className="muted" style={{ fontSize: "0.78rem" }}>{location.code}</div>
                  </td>
                  <td>
                    <span className="badge">{TYPE_LABEL[location.type]}</span>
                    {!location.active && <span className="badge warn" style={{ marginLeft: 6 }}>Inactive</span>}
                  </td>
                  <td>
                    {location.type !== "STORE" ? (
                      <span className="muted">—</span>
                    ) : location.registers.length === 0 ? (
                      <span className="badge warn">No registers</span>
                    ) : (
                      location.registers.map((r) => (
                        <span key={r.id} className="badge" title={r.name} style={{ marginRight: 6 }}>
                          {r.code} · {r.name}
                        </span>
                      ))
                    )}
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {location.type === "STORE" && (
                      <>
                        <button onClick={() => setAddingRegisterTo(location)} disabled={!location.active}>
                          Add register
                        </button>{" "}
                      </>
                    )}
                    <button onClick={() => setRenaming(location)}>Rename</button>{" "}
                    <button onClick={() => setToggling(location)}>{location.active ? "Deactivate" : "Reactivate"}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {adding && (
        <AddLocationModal
          existing={locations}
          onClose={() => setAdding(false)}
          onSaved={(created) => {
            setAdding(false);
            flash.success(
              created.type === "STORE"
                ? `${created.name} added — add a register so it can make sales`
                : `${created.name} added`,
            );
            reload();
          }}
        />
      )}

      {renaming && (
        <RenameLocationModal
          location={renaming}
          onClose={() => setRenaming(null)}
          onSaved={(name) => {
            setRenaming(null);
            flash.success(`${renaming.code} renamed to ${name}`);
            reload();
          }}
        />
      )}

      {addingRegisterTo && (
        <AddRegisterModal
          store={addingRegisterTo}
          onClose={() => setAddingRegisterTo(null)}
          onSaved={(code) => {
            setAddingRegisterTo(null);
            flash.success(`${code} added to ${addingRegisterTo.name}`);
            reload();
          }}
        />
      )}

      {toggling && (
        <ToggleActiveModal
          location={toggling}
          onClose={() => setToggling(null)}
          onSaved={() => {
            setToggling(null);
            flash.success(`${toggling.name} ${toggling.active ? "deactivated" : "reactivated"}`);
            reload();
          }}
        />
      )}
    </AppShell>
  );
}

function CodeField({
  label,
  value,
  onChange,
  touched,
  taken,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (code: string) => void;
  touched: boolean;
  taken: boolean;
  placeholder: string;
}) {
  const error = codeError(value) ?? (taken ? `${value} is already in use` : null);
  return (
    <label>
      {label}
      <input
        required
        value={value}
        onChange={(e) => onChange(normalizeCode(e.target.value))}
        placeholder={placeholder}
        autoCapitalize="characters"
        spellCheck={false}
        aria-invalid={touched && Boolean(error)}
      />
      {touched && error && <span className="error" style={{ fontSize: "0.82rem" }}>{error}</span>}
    </label>
  );
}

function AddLocationModal({
  existing,
  onClose,
  onSaved,
}: {
  existing: DirectoryLocation[];
  onClose: () => void;
  onSaved: (created: { name: string; type: LocationType }) => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState<LocationType>("STORE");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const taken = existing.some((l) => l.code === code);
  const invalid = Boolean(codeError(code)) || taken || !name.trim();

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (invalid) return;
    setBusy(true);
    setError(null);
    try {
      onSaved(await directoryApi.createLocation({ code, name: name.trim(), type }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open title="Add location" onClose={onClose}>
      <form onSubmit={save}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {(Object.keys(TYPE_LABEL) as LocationType[]).map((t) => (
            <label
              key={t}
              className="card"
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                gap: "0.6rem",
                padding: "0.7rem 0.8rem",
                cursor: "pointer",
                borderColor: type === t ? "var(--accent)" : undefined,
                background: type === t ? "var(--accent-soft)" : undefined,
              }}
            >
              <input type="radio" name="type" checked={type === t} onChange={() => setType(t)} />
              <span>
                <strong style={{ color: "var(--text)" }}>{TYPE_LABEL[t]}</strong>
                <br />
                {TYPE_HINT[t]}
              </span>
            </label>
          ))}
        </div>
        <label>
          Name
          <input
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={type === "STORE" ? "Karen Showroom" : "Mombasa Road Warehouse"}
          />
        </label>
        <CodeField
          label="Code"
          value={code}
          onChange={setCode}
          touched={code.length > 0}
          taken={taken}
          placeholder={type === "STORE" ? "STORE-3" : "WH-EAST"}
        />
        <p className="muted" style={{ margin: 0 }}>
          The code can&apos;t be changed later: sales, stock and reports in every module are recorded against it. The name
          can be changed at any time.
        </p>
        {error && <p className="error">{error}</p>}
        <div className="mms-modal-footer">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" type="submit" disabled={busy || invalid}>
            {busy ? "Adding…" : `Add ${TYPE_LABEL[type].toLowerCase()}`}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function RenameLocationModal({
  location,
  onClose,
  onSaved,
}: {
  location: DirectoryLocation;
  onClose: () => void;
  onSaved: (name: string) => void;
}) {
  const [name, setName] = useState(location.name);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const trimmed = name.trim();

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await directoryApi.updateLocation(location.code, { name: trimmed });
      onSaved(trimmed);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open title={`Rename ${location.code}`} onClose={onClose}>
      <form onSubmit={save}>
        <label>
          Name
          <input required autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <p className="muted" style={{ margin: 0 }}>The code {location.code} stays the same, so past records keep lining up.</p>
        {error && <p className="error">{error}</p>}
        <div className="mms-modal-footer">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" type="submit" disabled={busy || !trimmed || trimmed === location.name}>
            {busy ? "Saving…" : "Save name"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AddRegisterModal({
  store,
  onClose,
  onSaved,
}: {
  store: DirectoryLocation;
  onClose: () => void;
  onSaved: (code: string) => void;
}) {
  const [code, setCode] = useState(() => nextRegisterCode(store.registers));
  const [name, setName] = useState(() => `Till ${store.registers.length + 1}`);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const taken = store.registers.some((r) => r.code === code);
  const invalid = Boolean(codeError(code)) || taken || !name.trim();

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (invalid) return;
    setBusy(true);
    setError(null);
    try {
      await directoryApi.addRegister(store.code, { code, name: name.trim() });
      onSaved(code);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open title={`Add register — ${store.name}`} onClose={onClose}>
      <form onSubmit={save}>
        <label>
          Name
          <input required autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Till 3 (entrance)" />
        </label>
        <CodeField label="Code" value={code} onChange={setCode} touched taken={taken} placeholder="REG-3" />
        <p className="muted" style={{ margin: 0 }}>
          Cashiers pick this register at the POS, and each one is counted separately at close. The code can&apos;t be
          changed later.
        </p>
        {error && <p className="error">{error}</p>}
        <div className="mms-modal-footer">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" type="submit" disabled={busy || invalid}>
            {busy ? "Adding…" : "Add register"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ToggleActiveModal({
  location,
  onClose,
  onSaved,
}: {
  location: DirectoryLocation;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const deactivating = location.active;
  const kind = TYPE_LABEL[location.type].toLowerCase();
  // Only deactivation is checked; reactivating never strands anything.
  const [check, setCheck] = useState<DeactivationCheck | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);

  useEffect(() => {
    if (!deactivating) return;
    let cancelled = false;
    directoryApi
      .deactivationCheck(location.code)
      .then((result) => !cancelled && setCheck(result))
      .catch((err: Error) => !cancelled && setCheckError(err.message));
    return () => {
      cancelled = true;
    };
  }, [deactivating, location.code]);

  const blocked = deactivating && (!check || check.blockers.length > 0);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await directoryApi.updateLocation(location.code, { active: !deactivating });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open title={`${deactivating ? "Deactivate" : "Reactivate"} ${location.name}?`} onClose={onClose}>
      {deactivating ? (
        <p style={{ margin: 0 }}>
          {location.name} ({location.code}) will no longer appear in location pickers in any MMS app, so nobody can choose
          it for new sales, transfers or deliveries. Its past records stay as they are, and you can reactivate it at any
          time.
        </p>
      ) : (
        <p style={{ margin: 0 }}>
          {location.name} ({location.code}) will appear in location pickers again and can be used for new work.
        </p>
      )}
      {deactivating && !check && !checkError && <p className="muted" style={{ margin: 0 }}>Checking what&apos;s still open here…</p>}
      {checkError && <p className="error">Couldn&apos;t check this {kind}: {checkError}</p>}
      {check && check.blockers.length > 0 && (
        <div>
          <p className="error" style={{ margin: 0 }}>This {kind} can&apos;t be deactivated yet:</p>
          <ul className="error" style={{ margin: "0.3rem 0 0", paddingLeft: "1.2rem" }}>
            {check.blockers.map((b) => (
              <li key={b.kind + b.message}>{b.message}</li>
            ))}
          </ul>
        </div>
      )}
      {check && check.blockers.length === 0 && check.warnings.length > 0 && (
        <div>
          <p style={{ margin: 0 }}>
            <span className="badge warn">Before you go ahead</span>
          </p>
          <ul style={{ margin: "0.3rem 0 0", paddingLeft: "1.2rem" }}>
            {check.warnings.map((w) => (
              <li key={w.kind + w.message}>{w.message}</li>
            ))}
          </ul>
        </div>
      )}
      {error && <p className="error">{error}</p>}
      <div className="mms-modal-footer">
        <button type="button" onClick={onClose}>
          Cancel
        </button>
        <button className={deactivating ? "danger" : "primary"} type="button" onClick={confirm} disabled={busy || blocked}>
          {busy
            ? "Saving…"
            : deactivating && check?.warnings.length
              ? `Deactivate anyway`
              : `${deactivating ? "Deactivate" : "Reactivate"} ${kind}`}
        </button>
      </div>
    </Modal>
  );
}
