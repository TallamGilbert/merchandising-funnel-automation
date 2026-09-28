"use client";

import { SUPPORTED_CURRENCIES } from "../format/currency";

/** A fixed list, so a cost can only ever be labelled with a real currency code. */
export function CurrencySelect({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} required>
      {SUPPORTED_CURRENCIES.map((c) => (
        <option key={c.code} value={c.code}>
          {c.code} — {c.name}
        </option>
      ))}
    </select>
  );
}
