import { AccountType } from "../generated/prisma";

/**
 * The chart of accounts Financials posts to. Seeded (upserted) on start.
 * Codes follow the usual convention: 1xxx assets, 2xxx liabilities,
 * 4xxx revenue, 5xxx cost of sales, 6xxx operating expenses.
 */
export const ACCOUNTS = {
  CASH: { code: "1000", name: "Cash on hand", type: AccountType.ASSET },
  BANK: { code: "1010", name: "Bank", type: AccountType.ASSET },
  CARD_RECEIVABLE: { code: "1100", name: "Card settlements receivable", type: AccountType.ASSET },
  INVENTORY: { code: "1200", name: "Inventory", type: AccountType.ASSET },
  ACCOUNTS_PAYABLE: { code: "2000", name: "Accounts payable", type: AccountType.LIABILITY },
  VAT_PAYABLE: { code: "2100", name: "VAT payable", type: AccountType.LIABILITY },
  GIFT_CARDS: { code: "2200", name: "Gift card liability", type: AccountType.LIABILITY },
  SALES: { code: "4000", name: "Sales revenue", type: AccountType.REVENUE },
  /** Contra-revenue: refunds reduce revenue without editing the original sale. */
  SALES_RETURNS: { code: "4900", name: "Sales returns and refunds", type: AccountType.REVENUE },
  COGS: { code: "5000", name: "Cost of goods sold", type: AccountType.EXPENSE },
  CASH_OVER_SHORT: { code: "6100", name: "Cash over/short", type: AccountType.EXPENSE },
} as const;

export type AccountKey = keyof typeof ACCOUNTS;

/** Assets and expenses grow with debits; liabilities and revenue with credits. */
export function isDebitNormal(type: AccountType): boolean {
  return type === AccountType.ASSET || type === AccountType.EXPENSE;
}
