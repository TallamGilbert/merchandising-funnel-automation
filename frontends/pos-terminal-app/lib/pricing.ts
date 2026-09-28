import type { Product } from "./api";

export interface LinePricing {
  discountAmount: number;
  taxAmount: number;
  lineTotal: number;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Client-side preview only, so the cashier sees an accurate total before
 * payment capture — mirrors services/retail-sales/src/products/pricing.ts.
 * The server remains the source of truth; checkout re-prices every line and
 * rejects a payment total that doesn't match.
 */
export function activePromotion(product: Product, at: Date = new Date()) {
  return product.promotions.find(
    (promo) => new Date(promo.startsAt) <= at && new Date(promo.endsAt) >= at,
  );
}

export function computeLinePrice(
  unitPrice: number,
  quantity: number,
  discountPct: number | null,
  taxRatePct: number,
): LinePricing {
  const subtotal = round2(unitPrice * quantity);
  const discountAmount = discountPct ? round2(subtotal * (discountPct / 100)) : 0;
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = round2(taxableAmount * (taxRatePct / 100));
  const lineTotal = round2(taxableAmount + taxAmount);

  return { discountAmount, taxAmount, lineTotal };
}
