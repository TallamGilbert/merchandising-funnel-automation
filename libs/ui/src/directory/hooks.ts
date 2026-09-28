"use client";

import { useCallback, useEffect, useState } from "react";
import { directoryApi, DirectoryLocation, LocationType, StaffFilter, StaffMember } from "./client";

interface Loaded<T> {
  data: T;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

function useLoader<T>(load: () => Promise<T>, initial: T, key: string): Loaded<T> {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    load()
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setError(null);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(`Directory unavailable: ${err.message}`);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // `key` stands in for `load`, which is a fresh closure every render.
  }, [key, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { data, loading, error, reload };
}

export function useStaff(filter: StaffFilter = {}): Loaded<StaffMember[]> {
  const key = JSON.stringify(filter);
  return useLoader(() => directoryApi.listStaff(filter), [], key);
}

export function useLocations(type?: LocationType): Loaded<DirectoryLocation[]> {
  return useLoader(() => directoryApi.listLocations(type), [], type ?? "all");
}
