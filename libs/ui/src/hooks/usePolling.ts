"use client";

import { useEffect, useRef } from "react";

/**
 * Calls `refresh` every `intervalMs` while the tab is visible, and once
 * straight away when the user comes back to the tab — so a stock screen
 * reflects POS sales without a manual reload.
 */
export function usePolling(refresh: () => void | Promise<void>, intervalMs = 5000, enabled = true) {
  const latest = useRef(refresh);
  latest.current = refresh;

  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      if (document.visibilityState === "visible") void latest.current();
    };
    const timer = setInterval(tick, intervalMs);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [intervalMs, enabled]);
}
