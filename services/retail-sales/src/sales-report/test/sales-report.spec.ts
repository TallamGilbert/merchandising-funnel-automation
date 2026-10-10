import { buildSalesReport, hourKey, ReturnRow, SaleRow } from "../sales-report";

const TZ = "Africa/Nairobi"; // UTC+3, no daylight saving

function sale(overrides: Partial<SaleRow>): SaleRow {
  return {
    id: "t1",
    storeId: "STORE-1",
    cashierId: "cashier-amy",
    createdAt: new Date("2026-10-01T07:15:00Z"), // 10:15 in Nairobi
    discountAmount: 0,
    taxAmount: 16,
    totalAmount: 116,
    lines: [{ sku: "SOFA-1", productName: "Sofa", quantitySold: 1, discountAmount: 0, taxAmount: 16, lineTotal: 116 }],
    ...overrides,
  };
}

const sales: SaleRow[] = [
  sale({ id: "t1" }),
  sale({
    id: "t2",
    cashierId: "cashier-brian",
    createdAt: new Date("2026-10-01T13:40:00Z"), // 16:40
    discountAmount: 10,
    taxAmount: 30,
    totalAmount: 220,
    lines: [
      { sku: "SOFA-1", productName: "Sofa", quantitySold: 1, discountAmount: 10, taxAmount: 14.4, lineTotal: 104.4 },
      { sku: "LAMP-1", productName: "Lamp", quantitySold: 2, discountAmount: 0, taxAmount: 15.6, lineTotal: 115.6 },
    ],
  }),
  sale({ id: "t3", storeId: "STORE-2", createdAt: new Date("2026-10-02T07:05:00Z") }),
];

const returns: ReturnRow[] = [
  {
    createdAt: new Date("2026-10-02T13:00:00Z"), // 16:00
    storeId: "STORE-1",
    refundAmount: 57.8,
    originalCashierId: "cashier-brian",
    lines: [{ sku: "LAMP-1", productName: "Lamp", quantityReturned: 1, refundAmount: 57.8 }],
  },
];

const byKey = (rows: ReturnType<typeof buildSalesReport>) => Object.fromEntries(rows.map((r) => [r.key, r]));

describe("buildSalesReport", () => {
  it("groups by cashier, counting returns against whoever made the sale", () => {
    const rows = byKey(buildSalesReport(sales, returns, "cashier", TZ));
    expect(rows["cashier-amy"]).toMatchObject({ transactions: 2, units: 2, sales: 232, returns: 0, net: 232 });
    expect(rows["cashier-brian"]).toMatchObject({
      transactions: 1,
      units: 3,
      sales: 220,
      discounts: 10,
      vat: 30,
      returns: 57.8,
      unitsReturned: 1,
      net: 162.2,
    });
  });

  it("groups by hour of day in the report's time zone, in time order", () => {
    const rows = buildSalesReport(sales, returns, "hour", TZ);
    expect(rows.map((r) => r.key)).toEqual(["10", "16"]);
    expect(rows[0]).toMatchObject({ transactions: 2, sales: 232 }); // t1 10:15, t3 10:05
    expect(rows[1]).toMatchObject({ transactions: 1, sales: 220, returns: 57.8 }); // t2 16:40, return 16:00
  });

  it("groups by product, using line amounts and the product's returns", () => {
    const rows = byKey(buildSalesReport(sales, returns, "sku", TZ));
    expect(rows["SOFA-1"]).toMatchObject({ label: "Sofa", transactions: 3, units: 3, sales: 336.4, discounts: 10 });
    expect(rows["LAMP-1"]).toMatchObject({ label: "Lamp", transactions: 1, units: 2, sales: 115.6, returns: 57.8, net: 57.8 });
  });

  it("groups by day and by store", () => {
    expect(buildSalesReport(sales, returns, "day", TZ).map((r) => [r.key, r.net])).toEqual([
      ["2026-10-01", 336],
      ["2026-10-02", 58.2],
    ]);
    expect(byKey(buildSalesReport(sales, returns, "store", TZ))).toMatchObject({
      "STORE-1": { transactions: 2, net: 278.2 },
      "STORE-2": { transactions: 1, net: 116 },
    });
  });

  it("puts the biggest net first for non-time groupings", () => {
    expect(buildSalesReport(sales, [], "cashier", TZ).map((r) => r.key)).toEqual(["cashier-amy", "cashier-brian"]);
  });

  it("returns nothing for no activity", () => {
    expect(buildSalesReport([], [], "day", TZ)).toEqual([]);
  });
});

describe("hourKey", () => {
  it("pads and uses the 24-hour clock", () => {
    expect(hourKey(new Date("2026-10-01T21:30:00Z"), TZ)).toBe("00");
    expect(hourKey(new Date("2026-10-01T05:59:00Z"), TZ)).toBe("08");
    expect(hourKey(new Date("2026-10-01T05:59:00Z"), "UTC")).toBe("05");
  });
});
