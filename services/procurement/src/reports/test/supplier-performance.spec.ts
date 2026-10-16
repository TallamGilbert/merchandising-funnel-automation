import { PoForPerformance, supplierPerformance } from "../supplier-performance";

const po = (overrides: Partial<PoForPerformance>): PoForPerformance => ({
  supplierId: "s1",
  supplierName: "Acme Furniture",
  status: "CLOSED",
  currency: "KES",
  totalAmount: 1000,
  lines: [{ quantityOrdered: 10, quantityReceived: 10 }],
  ...overrides,
});

describe("supplierPerformance", () => {
  const rows = supplierPerformance([
    po({ lines: [{ quantityOrdered: 10, quantityReceived: 8 }] }),
    po({ lines: [{ quantityOrdered: 10, quantityReceived: 12 }] }), // over-delivery capped
    po({ status: "SENT", totalAmount: 500, lines: [{ quantityOrdered: 20, quantityReceived: 0 }] }),
    po({ currency: "USD", totalAmount: 99, lines: [{ quantityOrdered: 1, quantityReceived: 1 }] }),
    po({ supplierId: "s2", supplierName: "Bee Beds", status: "APPROVED", totalAmount: 5000, lines: [] }),
  ]);
  const acme = rows.find((r) => r.supplierId === "s1")!;

  it("totals orders and KES spend, counting other currencies separately", () => {
    expect(acme).toMatchObject({ purchaseOrders: 4, openOrders: 1, closedOrders: 3, spendKes: 2500, otherCurrencyOrders: 1 });
  });

  it("measures fill rate on closed POs only, capping over-delivery", () => {
    expect(acme.fillRate).toBe(0.905); // (8 + 10 + 1) / (10 + 10 + 1) = 19 / 21
    expect(acme).toMatchObject({ unitsOrdered: 41, unitsReceived: 19 });
  });

  it("has no fill rate until a PO closes", () => {
    expect(rows.find((r) => r.supplierId === "s2")?.fillRate).toBeNull();
  });

  it("lists the biggest spend first", () => {
    expect(rows.map((r) => r.supplierName)).toEqual(["Bee Beds", "Acme Furniture"]);
  });
});
