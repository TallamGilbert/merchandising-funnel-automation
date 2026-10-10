import { classifyMovement, MovementInput } from "../stock-movement";

const row = (overrides: Partial<MovementInput>): MovementInput => ({
  sku: "SKU",
  productName: "Thing",
  category: null,
  locationCode: "STORE-1",
  onHand: 10,
  unitCost: 100,
  unitsSold: 0,
  lastSaleAt: null,
  ...overrides,
});

describe("classifyMovement", () => {
  const rows = classifyMovement(
    [
      row({ sku: "FAST", onHand: 10, unitsSold: 90 }), // 1/day → 10 days of cover
      row({ sku: "SLOW", onHand: 50, unitsSold: 9, lastSaleAt: new Date("2026-09-01T00:00:00Z") }), // 0.1/day → 500 days
      row({ sku: "DEAD-CHEAP", onHand: 1, unitCost: 10 }),
      row({ sku: "DEAD-PRICEY", onHand: 3, unitCost: 5000 }),
    ],
    90,
    90,
  );
  const bySku = Object.fromEntries(rows.map((r) => [r.sku, r]));

  it("calls stock with no sales in the window dead", () => {
    expect(bySku["DEAD-PRICEY"]).toMatchObject({ status: "DEAD", daysOfCover: null, stockValue: 15000 });
  });

  it("calls stock with more cover than the threshold slow", () => {
    expect(bySku.SLOW).toMatchObject({ status: "SLOW", daysOfCover: 500, lastSaleAt: "2026-09-01T00:00:00.000Z" });
  });

  it("calls the rest OK", () => {
    expect(bySku.FAST).toMatchObject({ status: "OK", daysOfCover: 10 });
  });

  it("lists dead stock first (most money tied up first), then slow, then OK", () => {
    expect(rows.map((r) => r.sku)).toEqual(["DEAD-PRICEY", "DEAD-CHEAP", "SLOW", "FAST"]);
  });

  it("respects a different threshold", () => {
    expect(classifyMovement([row({ onHand: 10, unitsSold: 9 })], 90, 200)[0].status).toBe("OK"); // 100 days
  });
});
