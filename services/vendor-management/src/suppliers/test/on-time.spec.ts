import { DeliveryForPerformance, onTimePerformance } from "../on-time";

const d = (overrides: Partial<DeliveryForPerformance>): DeliveryForPerformance => ({
  supplierId: "s1",
  supplierName: "Acme",
  expectedDate: new Date("2026-10-01"),
  actualDeliveryDate: new Date("2026-10-01"),
  onTime: true,
  ...overrides,
});

describe("onTimePerformance", () => {
  const rows = onTimePerformance([
    d({}),
    d({ onTime: false, actualDeliveryDate: new Date("2026-10-04") }),
    d({ onTime: false, actualDeliveryDate: new Date("2026-10-06") }),
    d({ supplierId: "s2", supplierName: "Bee" }),
  ]);

  it("rates each supplier and averages how late the late ones were", () => {
    expect(rows.find((r) => r.supplierId === "s1")).toEqual({
      supplierId: "s1",
      supplierName: "Acme",
      deliveries: 3,
      onTime: 1,
      late: 2,
      onTimeRate: 0.333,
      averageDaysLate: 4,
    });
  });

  it("puts the least reliable first", () => {
    expect(rows.map((r) => r.supplierId)).toEqual(["s1", "s2"]);
    expect(rows[1]).toMatchObject({ onTimeRate: 1, averageDaysLate: null });
  });
});
