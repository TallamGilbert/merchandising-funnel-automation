/**
 * Currencies a supplier cost or PO may be quoted in. KES is the business's
 * own currency and the default everywhere (PRD §2.2: no multi-currency
 * reporting in v1 — amounts are labelled, never converted).
 */
export const SUPPORTED_CURRENCIES = [
  { code: "KES", name: "Kenyan Shilling" },
  { code: "USD", name: "US Dollar" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]["code"];

export const DEFAULT_CURRENCY: CurrencyCode = "KES";

export function isSupportedCurrency(code: string): code is CurrencyCode {
  return SUPPORTED_CURRENCIES.some((c) => c.code === code);
}
