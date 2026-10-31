/** What every paged MMS list endpoint returns. */
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type QueryValue = string | number | boolean | null | undefined;

/** `paging + search + the list's own filters`; empty values are left out of the URL. */
export interface ListParams {
  page?: number;
  pageSize?: number;
  q?: string;
  [filter: string]: QueryValue;
}

/** `url` with `params` as its query string, skipping empty values. */
export function withQuery(url: string, params: Record<string, QueryValue> = {}): string {
  const entries = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => [k, String(v)] as [string, string]);
  if (!entries.length) return url;
  return `${url}${url.includes("?") ? "&" : "?"}${new URLSearchParams(entries).toString()}`;
}

export type ExportFormat = "csv" | "xlsx";

/**
 * Download link for a list: the same filters and search, every matching row
 * (the API ignores paging when `format` is set). Opened as a plain link, so
 * the session cookie goes along.
 */
export function exportUrl(url: string, params: ListParams, format: ExportFormat): string {
  const { page: _page, pageSize: _pageSize, ...filters } = params;
  return withQuery(url, { ...filters, format });
}

const MAX_PAGE_SIZE = 100;
/** A dashboard total over more than this many rows should come from a summary endpoint instead. */
const MAX_PAGES = 50;

/**
 * Every row of a paged list, a page at a time — for totals, charts and
 * pickers that need the whole set. Throws rather than silently returning a
 * partial list.
 */
export async function fetchAllPages<T>(fetchPage: (page: number, pageSize: number) => Promise<Page<T>>): Promise<T[]> {
  const first = await fetchPage(1, MAX_PAGE_SIZE);
  const items = [...first.items];
  const pages = Math.ceil(first.total / MAX_PAGE_SIZE);
  if (pages > MAX_PAGES) {
    throw new Error(`Too many rows to load at once (${first.total}); narrow the filter`);
  }
  for (let page = 2; page <= pages; page++) {
    items.push(...(await fetchPage(page, MAX_PAGE_SIZE)).items);
  }
  return items;
}
