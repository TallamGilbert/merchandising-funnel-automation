import { computeLinePrice } from "./pricing";

describe("computeLinePrice", () => {
  it("prices a line with no promotion and no tax", () => {
    const result = computeLinePrice(10, 3, null, 0);
    expect(result).toEqual({ discountAmount: 0, taxAmount: 0, lineTotal: 30 });
  });

  it("applies tax on the full subtotal when there is no promotion", () => {
    const result = computeLinePrice(100, 1, null, 7.5);
    expect(result).toEqual({ discountAmount: 0, taxAmount: 7.5, lineTotal: 107.5 });
  });

  it("discounts the subtotal before computing tax", () => {
    const result = computeLinePrice(100, 1, { discountPct: 20 }, 10);
    // subtotal 100, discount 20, taxable 80, tax 8, total 88
    expect(result).toEqual({ discountAmount: 20, taxAmount: 8, lineTotal: 88 });
  });

  it("scales with quantity", () => {
    const result = computeLinePrice(19.99, 3, null, 0);
    expect(result.lineTotal).toBe(59.97);
  });

  it("rounds to the nearest cent", () => {
    const result = computeLinePrice(3.333, 3, null, 0);
    expect(result.lineTotal).toBe(10);
  });
});
