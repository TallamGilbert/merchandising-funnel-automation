"use client";

import { Combobox, ComboboxOption } from "../components/Combobox";
import { LocationType, StaffMember, STAFF_ROLE_LABEL, StaffRole } from "./client";
import { useLocations, useStaff } from "./hooks";

interface PickerProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  "aria-label"?: string;
}

function DirectoryError({ message }: { message: string | null }) {
  return message ? <span className="mms-field-error">{message}</span> : null;
}

/** Pick a person by name; the form receives their staff id (e.g. "cashier-amy"). */
export function StaffPicker({
  roles,
  locationCode,
  onSelectMember,
  ...props
}: PickerProps & {
  roles?: StaffRole[];
  locationCode?: string;
  /** The whole record — e.g. to take the approver's role from the person picked. */
  onSelectMember?: (member: StaffMember | null) => void;
}) {
  const { data: staff, loading, error } = useStaff({ roles, locationCode });
  const options: ComboboxOption[] = staff.map((s) => ({
    value: s.id,
    label: s.name,
    description: [s.id, STAFF_ROLE_LABEL[s.role], s.locationCode].filter(Boolean).join(" · "),
  }));

  return (
    <>
      <Combobox
        options={options}
        loading={loading}
        placeholder={props.placeholder ?? "Search by name…"}
        emptyMessage="No matching staff"
        value={props.value}
        required={props.required}
        disabled={props.disabled}
        aria-label={props["aria-label"]}
        onChange={(value) => {
          props.onChange(value);
          onSelectMember?.(staff.find((s) => s.id === value) ?? null);
        }}
      />
      <DirectoryError message={error} />
    </>
  );
}

/** Pick a store or warehouse by name; the form receives its code (e.g. "STORE-1"). */
export function LocationPicker({ type, ...props }: PickerProps & { type?: LocationType }) {
  const { data: locations, loading, error } = useLocations(type);
  const options: ComboboxOption[] = locations.map((l) => ({
    value: l.code,
    label: `${l.name} (${l.code})`,
    description: l.type === "STORE" ? "Store" : "Warehouse",
  }));

  return (
    <>
      <Combobox
        options={options}
        loading={loading}
        placeholder={props.placeholder ?? (type === "STORE" ? "Search stores…" : "Search locations…")}
        emptyMessage="No matching locations"
        value={props.value}
        onChange={(value) => props.onChange(value)}
        required={props.required}
        disabled={props.disabled}
        aria-label={props["aria-label"]}
      />
      <DirectoryError message={error} />
    </>
  );
}

/** Pick one of a store's registers; disabled until a store is chosen. */
export function RegisterPicker({ locationCode, ...props }: PickerProps & { locationCode: string }) {
  const { data: stores, loading, error } = useLocations("STORE");
  const registers = stores.find((s) => s.code === locationCode)?.registers ?? [];
  const options: ComboboxOption[] = registers.map((r) => ({ value: r.code, label: `${r.name} (${r.code})` }));

  return (
    <>
      <Combobox
        options={options}
        loading={loading}
        placeholder={locationCode ? (props.placeholder ?? "Search registers…") : "Choose a store first"}
        emptyMessage="This store has no registers"
        value={props.value}
        onChange={(value) => props.onChange(value)}
        required={props.required}
        disabled={props.disabled || !locationCode}
        aria-label={props["aria-label"]}
      />
      <DirectoryError message={error} />
    </>
  );
}
