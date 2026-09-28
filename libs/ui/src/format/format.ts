import { DEFAULT_CURRENCY } from "./currency";

type Numeric = number | string | null | undefined;

const numberFormat = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const integerFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function toNumber(value: Numeric): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** 2999.99 → "2,999.99". Accepts Prisma's Decimal-as-string too. */
export function formatAmount(value: Numeric): string {
  const n = toNumber(value);
  return n === null ? "—" : numberFormat.format(n);
}

/** 2999.99 → "KES 2,999.99". Every money amount on screen goes through this. */
export function formatMoney(value: Numeric, currency: string = DEFAULT_CURRENCY): string {
  const n = toNumber(value);
  if (n === null) return "—";
  const sign = n < 0 ? "-" : "";
  return `${sign}${currency} ${numberFormat.format(Math.abs(n))}`;
}

/** Signed money for discrepancies: "+KES 50.00" / "-KES 50.00" / "KES 0.00". */
export function formatSignedMoney(value: Numeric, currency: string = DEFAULT_CURRENCY): string {
  const n = toNumber(value);
  if (n === null) return "—";
  return n > 0 ? `+${formatMoney(n, currency)}` : formatMoney(n, currency);
}

/** Quantities: 12500 → "12,500". */
export function formatQuantity(value: Numeric): string {
  const n = toNumber(value);
  return n === null ? "—" : integerFormat.format(n);
}

export interface DateFormatOptions {
  /** IANA zone; defaults to the viewer's own. Fixed in tests. */
  timeZone?: string;
}

const BUSINESS_DATE = /^\d{4}-\d{2}-\d{2}$/;

function toDate(value: Date | string): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  // A bare business date ("2026-09-25") is a calendar day, not an instant —
  // pin it to midday UTC so no time zone shifts it onto a neighbouring day.
  const date = BUSINESS_DATE.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "25 September 2026". */
export function formatDate(value: Date | string | null | undefined, options: DateFormatOptions = {}): string {
  if (!value) return "—";
  const date = toDate(value);
  if (!date) return "—";
  const timeZone = typeof value === "string" && BUSINESS_DATE.test(value) ? "UTC" : options.timeZone;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone }).format(date);
}

/** "25 September 2026 at 4:19 PM". */
export function formatDateTime(value: Date | string | null | undefined, options: DateFormatOptions = {}): string {
  if (!value) return "—";
  const date = toDate(value);
  if (!date) return "—";
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: options.timeZone,
  }).format(date);
  return `${formatDate(date, options)} at ${time}`;
}
