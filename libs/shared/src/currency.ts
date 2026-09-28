/**
 * Currency codes a supplier cost or PO may be labelled with. KES is the
 * business's own currency and the default (PRD §2.2: amounts are labelled,
 * never converted). Mirrored for display in @mms/ui's SUPPORTED_CURRENCIES.
 */
export const SUPPORTED_CURRENCY_CODES = ["KES", "USD", "EUR", "GBP"] as const;

export type SupportedCurrencyCode = (typeof SUPPORTED_CURRENCY_CODES)[number];

export const DEFAULT_CURRENCY_CODE: SupportedCurrencyCode = "KES";
