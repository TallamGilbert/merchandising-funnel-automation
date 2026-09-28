"use client";

import { useEffect, useState } from "react";

const KEY = "mms.warehouse-floor.operator";

/**
 * Whoever is using this handheld — picked once, remembered on the device,
 * so every putaway/pick card doesn't ask again. Storage can be unavailable
 * (private mode), in which case it simply isn't remembered.
 */
export function useOperator(): [string, (id: string) => void] {
  const [operator, setOperator] = useState("");

  useEffect(() => {
    try {
      setOperator(localStorage.getItem(KEY) ?? "");
    } catch {
      // not remembered
    }
  }, []);

  const update = (id: string) => {
    setOperator(id);
    try {
      localStorage.setItem(KEY, id);
    } catch {
      // not remembered
    }
  };

  return [operator, update];
}
