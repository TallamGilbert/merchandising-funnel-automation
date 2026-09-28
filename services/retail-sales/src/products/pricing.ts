export interface ActivePromotion {
  discountPct: number;
}

export interface LinePricing {
  discountAmount: number;
  taxAmount: number;
  lineTotal: number;
}

/**
 * FR-6.1/6.3 — prices one checkout line. A promotion (if active) discounts
 * the subtotal first; tax is then computed on the post-discount amount.
 * Rounded to cents at each step so line totals always match what a receipt
 * would show, rather than accumulating fractional-cent drift.
 */
export function computeLinePrice(
  unitPrice: number,
  quantity: number,
  activePromotion: ActivePromotion | null,
  taxRatePct: number,
): LinePricing {
  const subtotal = round2(unitPrice * quantity);
  const discountAmount = activePromotion
    ? round2(subtotal * (activePromotion.discountPct / 100))
    : 0;
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = round2(taxableAmount * (taxRatePct / 100));
  const lineTotal = round2(taxableAmount + taxAmount);

  return { discountAmount, taxAmount, lineTotal };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
