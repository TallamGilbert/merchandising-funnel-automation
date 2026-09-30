"use client";

import { useEffect, useRef, useState } from "react";
import { usePolling } from "@mms/ui";

export interface Live<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

/**
 * Loads one module's numbers and keeps them fresh. Each panel has its own,
 * so one module being down only greys out its own panel — never the page.
 * Keeps the last good data while a refresh is in flight.
 */
export function useLive<T>(load: () => Promise<T>, deps: unknown[], refreshMs = 60000): Live<T> {
  const [state, setState] = useState<Live<T>>({ data: null, error: null, loading: true });
  const latest = useRef(load);
  latest.current = load;

  const run = () => {
    setState((s) => ({ ...s, loading: true }));
    latest.current().then(
      (data) => setState({ data, error: null, loading: false }),
      (err: Error) => setState((s) => ({ data: s.data, error: err.message, loading: false })),
    );
  };

  // `deps` are the inputs `load` closes over (dates, store list).
  useEffect(run, deps);
  usePolling(run, refreshMs);
  return state;
}

/** Runs one request per item and keeps the ones that answered. */
export async function settled<I, T>(items: I[], fn: (item: I) => Promise<T>): Promise<{ item: I; value: T }[]> {
  const results = await Promise.allSettled(items.map(fn));
  const ok: { item: I; value: T }[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") ok.push({ item: items[i], value: r.value });
  });
  if (items.length > 0 && ok.length === 0) {
    const first = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
    throw first?.reason instanceof Error ? first.reason : new Error("unavailable");
  }
  return ok;
}
