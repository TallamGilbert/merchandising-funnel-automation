import { EXPORT_MAX_ROWS, ListQueryDto } from "./list-query.dto";

/** The shape every paged list endpoint returns. */
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Prisma `skip`/`take` for the query — the whole (capped) result when exporting. */
export function pageArgs(query: Pick<ListQueryDto, "page" | "pageSize" | "format">): { skip: number; take: number } {
  if (query.format) return { skip: 0, take: EXPORT_MAX_ROWS };
  return { skip: (query.page - 1) * query.pageSize, take: query.pageSize };
}

export function paged<T>(items: T[], total: number, query: Pick<ListQueryDto, "page" | "pageSize">): Page<T> {
  return { items, total, page: query.page, pageSize: query.pageSize };
}

/**
 * Prisma `contains` filters across `fields` for a search term, e.g.
 * `searchAny(q, ["poNumber", "supplierName"])` → `{ OR: [...] }`, or
 * undefined without a term. Case-insensitive (Postgres ILIKE).
 */
export function searchAny(q: string | undefined, fields: string[]): { OR: Record<string, unknown>[] } | undefined {
  if (!q) return undefined;
  return { OR: fields.map((field) => ({ [field]: { contains: q, mode: "insensitive" } })) };
}

/**
 * Inclusive YYYY-MM-DD range as a Prisma DateTime filter (UTC day
 * boundaries, like the rest of the system), or undefined.
 */
export function dateRange(from?: string, to?: string): { gte?: Date; lt?: Date } | undefined {
  if (!from && !to) return undefined;
  const range: { gte?: Date; lt?: Date } = {};
  if (from) range.gte = new Date(`${from}T00:00:00.000Z`);
  if (to) {
    const end = new Date(`${to}T00:00:00.000Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    range.lt = end;
  }
  return range;
}
