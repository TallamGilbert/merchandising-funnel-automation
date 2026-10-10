import { ExportColumn, ExportValue } from "./export-columns";

const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);

/**
 * RFC 4180 CSV with a UTF-8 byte-order mark and CRLF line ends, which is
 * what Excel needs to open accented names and KES amounts correctly.
 */
export function toCsv<T>(columns: ExportColumn<T>[], rows: T[]): Buffer {
  const lines = [columns.map((c) => cell(c.header)).join(",")];
  for (const row of rows) lines.push(columns.map((c) => cell(c.value(row))).join(","));
  return Buffer.concat([UTF8_BOM, Buffer.from(`${lines.join("\r\n")}\r\n`, "utf8")]);
}

function cell(value: ExportValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  let text = value instanceof Date ? value.toISOString() : String(value);
  // A text cell starting like a formula would run as one in Excel/Sheets
  // (CSV injection) — e.g. a supplier named "=HYPERLINK(...)".
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
