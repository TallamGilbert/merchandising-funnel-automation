"use client";

import { useEffect, useRef, useState } from "react";
import { ExportFormat, Page } from "./page";

/** "41–60 of 213" with previous/next — sits under a paged table. */
export function Pagination({
  data,
  onPageChange,
}: {
  data: Pick<Page<unknown>, "page" | "pageSize" | "total"> | null;
  onPageChange: (page: number) => void;
}) {
  if (!data || data.total === 0) return null;
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const first = (data.page - 1) * data.pageSize + 1;
  const last = Math.min(data.page * data.pageSize, data.total);

  return (
    <nav className="mms-pagination" aria-label="Pages">
      <span className="muted">
        {first.toLocaleString()}–{last.toLocaleString()} of {data.total.toLocaleString()}
      </span>
      <div className="mms-pagination-buttons">
        <button type="button" disabled={data.page <= 1} onClick={() => onPageChange(data.page - 1)}>
          Previous
        </button>
        <span className="muted">
          Page {data.page} of {pages}
        </span>
        <button type="button" disabled={data.page >= pages} onClick={() => onPageChange(data.page + 1)}>
          Next
        </button>
      </div>
    </nav>
  );
}

/**
 * Download the list as it's filtered right now — every matching row, not
 * just this page. `href` builds the export link for a format (see exportUrl).
 */
export function ExportMenu({ href, disabled }: { href: (format: ExportFormat) => string; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div className="mms-export" ref={ref}>
      <button type="button" disabled={disabled} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        Export
      </button>
      {open && (
        <div className="mms-export-menu" role="menu">
          <a role="menuitem" href={href("xlsx")} download onClick={() => setOpen(false)}>
            Excel (.xlsx)
          </a>
          <a role="menuitem" href={href("csv")} download onClick={() => setOpen(false)}>
            CSV
          </a>
        </div>
      )}
    </div>
  );
}
