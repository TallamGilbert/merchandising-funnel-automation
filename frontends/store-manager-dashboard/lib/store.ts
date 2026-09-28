"use client";

import { useEffect, useState } from "react";

const KEY = "mms.store-manager.store";

/** The manager's store, shared by Overview and Close and remembered on this device. */
export function useSelectedStore(): [string, (code: string) => void] {
  const [store, setStore] = useState("");

  useEffect(() => {
    try {
      setStore(localStorage.getItem(KEY) ?? "");
    } catch {
      // not remembered
    }
  }, []);

  const update = (code: string) => {
    setStore(code);
    try {
      localStorage.setItem(KEY, code);
    } catch {
      // not remembered
    }
  };

  return [store, update];
}
