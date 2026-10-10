"use client";

import { useEffect, useState } from "react";

export interface TerminalSettings {
  storeId: string;
  registerId: string;
}

const KEY = "mms.pos.terminal";
const EMPTY: TerminalSettings = { storeId: "", registerId: "" };

/**
 * A till's store and register rarely change, so the terminal remembers them
 * on this device. Until one is chosen, the store defaults to the signed-in
 * cashier's home store. The cashier is never stored: it's whoever is signed
 * in. Storage can be unavailable (private mode), in which case nothing is
 * remembered.
 */
export function useTerminal(
  homeStoreId?: string | null,
): [TerminalSettings, (patch: Partial<TerminalSettings>) => void] {
  const [settings, setSettings] = useState<TerminalSettings>(EMPTY);

  useEffect(() => {
    let saved: Partial<TerminalSettings> = {};
    try {
      saved = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<TerminalSettings>;
    } catch {
      // not remembered
    }
    setSettings({
      storeId: saved.storeId || homeStoreId || "",
      registerId: saved.registerId ?? "",
    });
  }, [homeStoreId]);

  const update = (patch: Partial<TerminalSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        // not remembered
      }
      return next;
    });
  };

  return [settings, update];
}

/**
 * useState that survives a reload of this tab (sessionStorage) — so a sale
 * in progress isn't lost if the session expires and the cashier signs in
 * again. Keyed per cashier, so the next person doesn't inherit a cart.
 */
export function useTabState<T>(key: string, initial: T): [T, (next: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(key);
      if (saved !== null) setValue(JSON.parse(saved) as T);
    } catch {
      // not restored
    }
    setLoaded(true);
  }, [key]);

  useEffect(() => {
    if (!loaded) return;
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      // not kept
    }
  }, [key, value, loaded]);

  return [value, setValue];
}
