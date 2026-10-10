/**
 * D-20 — which stock isn't moving. Pure classification, unit-tested on
 * plain rows: DEAD (stock on hand but no sale in the window), SLOW (more
 * days of cover than the threshold at the window's sales rate) or OK.
 */
export type MovementStatus = "DEAD" | "SLOW" | "OK";

export interface MovementInput {
  sku: string;
  productName: string;
  category: string | null;
  locationCode: string;
  onHand: number;
  unitCost: number;
  /** Units sold at this location within the window. */
  unitsSold: number;
  lastSaleAt: Date | null;
}

export interface MovementRow extends Omit<MovementInput, "lastSaleAt"> {
  stockValue: number;
  lastSaleAt: string | null;
  /** onHand ÷ average daily sales over the window; null when nothing sold. */
  daysOfCover: number | null;
  status: MovementStatus;
}

const ORDER: Record<MovementStatus, number> = { DEAD: 0, SLOW: 1, OK: 2 };

export function classifyMovement(rows: MovementInput[], windowDays: number, slowAfterDays: number): MovementRow[] {
  return rows
    .map((row) => {
      const perDay = row.unitsSold / windowDays;
      const daysOfCover = perDay > 0 ? Math.round(row.onHand / perDay) : null;
      const status: MovementStatus =
        daysOfCover === null ? "DEAD" : daysOfCover > slowAfterDays ? "SLOW" : "OK";
      return {
        ...row,
        stockValue: Math.round(row.onHand * row.unitCost * 100) / 100,
        lastSaleAt: row.lastSaleAt ? row.lastSaleAt.toISOString() : null,
        daysOfCover,
        status,
      };
    })
    .sort(
      (a, b) =>
        ORDER[a.status] - ORDER[b.status] ||
        // Dead stock: most money tied up first. Otherwise: slowest first.
        (a.status === "DEAD" ? b.stockValue - a.stockValue : (b.daysOfCover ?? 0) - (a.daysOfCover ?? 0)) ||
        a.sku.localeCompare(b.sku),
    );
}
