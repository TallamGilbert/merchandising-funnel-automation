"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ListParams, Page } from "./page";

export interface PagedList<T> {
  /** The current page, or null while the first one loads. */
  data: Page<T> | null;
  items: T[];
  loading: boolean;
  error: string | null;
  page: number;
  setPage: (page: number) => void;
  /** Search text as typed (the request waits for a pause in typing). */
  q: string;
  setQ: (q: string) => void;
  /** page + pageSize + q + filters — what the current request asked for. */
  params: ListParams;
  reload: () => void;
}

const SEARCH_DELAY_MS = 300;

/**
 * State for one server-paged list: page, debounced search and the list's
 * filters. Changing the search or a filter goes back to page 1. A response
 * that arrives after a newer request was made is dropped.
 */
export function usePagedList<T>(
  fetchPage: (params: ListParams) => Promise<Page<T>>,
  filters: Record<string, ListParams[string]> = {},
  pageSize = 20,
): PagedList<T> {
  const [data, setData] = useState<Page<T> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [version, setVersion] = useState(0);
  const latestFetch = useRef(fetchPage);
  latestFetch.current = fetchPage;

  const filterKey = JSON.stringify(filters);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(q.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [q]);

  // A new search or filter starts again from the first page.
  useEffect(() => setPage(1), [debouncedQ, filterKey]);

  const params: ListParams = { ...filters, q: debouncedQ || undefined, page, pageSize };
  const paramsKey = JSON.stringify(params);

  useEffect(() => {
    let current = true;
    setLoading(true);
    latestFetch
      .current(JSON.parse(paramsKey) as ListParams)
      .then((result) => {
        if (!current) return;
        setData(result);
        setError(null);
      })
      .catch((err: Error) => {
        if (current) setError(err.message);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [paramsKey, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  return { data, items: data?.items ?? [], loading, error, page, setPage, q, setQ, params, reload };
}
