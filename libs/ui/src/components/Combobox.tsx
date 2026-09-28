"use client";

import { KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from "react";

export interface ComboboxOption {
  value: string;
  label: string;
  /** Secondary line, also searched (e.g. a SKU under a product name). */
  description?: string;
  disabled?: boolean;
}

export interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string, option: ComboboxOption | null) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  loading?: boolean;
  /** Shown when the search matches nothing. */
  emptyMessage?: string;
  /** Clear the search box after each pick (e.g. adding SKUs to a cart). */
  clearOnSelect?: boolean;
  /** Show a × that resets an optional choice back to nothing. */
  clearable?: boolean;
  id?: string;
  name?: string;
  autoFocus?: boolean;
  "aria-label"?: string;
}

const MAX_VISIBLE = 50;

/**
 * Searchable single-select. Users type any part of a label, value or
 * description and pick from the matches — no one has to remember an id.
 * The text box always snaps back to the selected option's label on blur,
 * so the form can only ever submit a real option's value.
 */
export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Search…",
  required,
  disabled,
  loading,
  emptyMessage = "No matches",
  clearOnSelect,
  clearable,
  id,
  name,
  autoFocus,
  "aria-label": ariaLabel,
}: ComboboxProps) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = options.find((o) => o.value === value) ?? null;
  const [query, setQuery] = useState(selected?.label ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  // Keep the box in step with the selection when it changes from outside.
  useEffect(() => {
    if (!open) setQuery(selected?.label ?? "");
  }, [selected?.label, open]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const showAll = !q || (selected && query === selected.label);
    const filtered = showAll
      ? options
      : options.filter((o) =>
          [o.label, o.value, o.description ?? ""].some((field) => field.toLowerCase().includes(q)),
        );
    return filtered.slice(0, MAX_VISIBLE);
  }, [options, query, selected]);

  useEffect(() => setActive(0), [query]);

  function pick(option: ComboboxOption) {
    if (option.disabled) return;
    onChange(option.value, option);
    setQuery(clearOnSelect ? "" : option.label);
    setOpen(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && open) {
      e.preventDefault();
      const option = matches[active];
      if (option) pick(option);
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery(selected?.label ?? "");
    }
  }

  return (
    <div className={`mms-combobox${clearable && value ? " has-clear" : ""}`}>
      <input
        ref={inputRef}
        id={id}
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        autoFocus={autoFocus}
        disabled={disabled}
        placeholder={loading ? "Loading…" : placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={(e) => {
          setOpen(true);
          e.target.select();
        }}
        onBlur={() => {
          setOpen(false);
          setQuery(clearOnSelect ? "" : (selected?.label ?? ""));
        }}
        onKeyDown={onKeyDown}
      />
      {clearable && value && !disabled && (
        <button
          type="button"
          className="mms-icon-btn mms-combobox-clear"
          aria-label="Clear"
          onClick={() => {
            onChange("", null);
            setQuery("");
          }}
        >
          ×
        </button>
      )}
      {/* Carries the real value for native `required` validation and plain form posts. */}
      <input
        tabIndex={-1}
        aria-hidden
        className="mms-combobox-value"
        name={name}
        value={value}
        required={required}
        onChange={() => undefined}
        onFocus={() => inputRef.current?.focus()}
      />
      {open && !disabled && (
        <ul id={listId} role="listbox" className="mms-combobox-list">
          {loading ? (
            <li className="mms-combobox-empty">Loading…</li>
          ) : matches.length === 0 ? (
            <li className="mms-combobox-empty">{emptyMessage}</li>
          ) : (
            matches.map((option, i) => (
              <li
                key={option.value}
                role="option"
                aria-selected={option.value === value}
                aria-disabled={option.disabled}
                className={`mms-combobox-option${i === active ? " active" : ""}${option.disabled ? " disabled" : ""}`}
                // mousedown, not click — fires before the input's blur closes the list.
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(option);
                }}
                onMouseEnter={() => setActive(i)}
              >
                <span>{option.label}</span>
                {option.description && <span className="mms-combobox-desc">{option.description}</span>}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
