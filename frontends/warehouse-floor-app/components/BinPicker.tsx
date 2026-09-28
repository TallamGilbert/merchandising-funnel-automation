"use client";

import { Combobox, type ComboboxOption } from "@mms/ui";
import type { Bin } from "../lib/api";

function percent(used: string, capacity: string): number {
  const cap = Number(capacity);
  return cap > 0 ? Math.round((Number(used) / cap) * 100) : 0;
}

export function binOption(bin: Bin): ComboboxOption {
  const full = percent(bin.usedVolumeCm3, bin.capacityVolumeCm3);
  return {
    value: bin.code,
    label: bin.code,
    description: `Zone ${bin.zone} · ${full}% full · ${Math.round(Number(bin.maxWeightKg) - Number(bin.usedWeightKg))} kg free`,
    disabled: full >= 100,
  };
}

/** Pick a bin by code or zone, with how full each one is. */
export function BinPicker({
  bins,
  value,
  onChange,
  required,
  placeholder = "Search bins by code or zone…",
}: {
  bins: Bin[];
  value: string;
  onChange: (code: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  // Optional bins (the putaway override) can be cleared back to "auto-select".
  return (
    <Combobox
      options={bins.map(binOption)}
      value={value}
      onChange={(code) => onChange(code)}
      required={required}
      clearable={!required}
      placeholder={placeholder}
      emptyMessage="No bins at this location"
    />
  );
}
