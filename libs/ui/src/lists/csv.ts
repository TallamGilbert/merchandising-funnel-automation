const BOM = String.fromCharCode(0xfeff);

export type CsvValue = string | number | null | undefined;

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => CsvValue;
}

/**
 * CSV text the same way the APIs export it (D-18): a byte-order mark so
 * Excel reads UTF-8, CRLF line ends, and text that would run as a formula
 * prefixed with '. For reports the browser assembles from several APIs.
 */
export function toCsv<T>(columns: CsvColumn<T>[], rows: T[]): string {
  const lines = [columns.map((c) => cell(c.header)), ...rows.map((r) => columns.map((c) => cell(c.value(r))))];
  return `${BOM}${lines.map((l) => l.join(",")).join("\r\n")}\r\n`;
}

function cell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  let text = value;
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Saves `toCsv(columns, rows)` as `<name>-<today>.csv`. */
export function downloadCsv<T>(name: string, columns: CsvColumn<T>[], rows: T[]): void {
  const blob = new Blob([toCsv(columns, rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
