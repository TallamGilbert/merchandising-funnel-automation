"use client";

import { useEffect, useState } from "react";

export interface TerminalSettings {
  storeId: string;
  registerId: string;
  cashierId: string;
}

const KEY = "mms.pos.terminal";
const EMPTY: TerminalSettings = { storeId: "", registerId: "", cashierId: "" };

/**
 * A till's store and register rarely change, and a cashier works a whole
 * shift — so the terminal remembers them on this device. Storage can be
 * unavailable (private mode), in which case they're simply not remembered.
 */
export function useTerminal(): [TerminalSettings, (patch: Partial<TerminalSettings>) => void] {
  const [settings, setSettings] = useState<TerminalSettings>(EMPTY);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) setSettings({ ...EMPTY, ...(JSON.parse(saved) as Partial<TerminalSettings>) });
    } catch {
      // not remembered
    }
  }, []);

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
