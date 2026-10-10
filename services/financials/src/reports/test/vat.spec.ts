import { EntrySource } from "../../generated/prisma";
import { vatByMonth } from "../vat";

describe("vatByMonth", () => {
  const line = (month: string, source: EntrySource, credit: number, debit = 0) => ({
    occurredAt: new Date(`${month}-15T10:00:00Z`),
    source,
    credit,
    debit,
  });

  const report = vatByMonth([
    line("2026-10", EntrySource.ITEM_SOLD, 160),
    line("2026-10", EntrySource.ITEM_SOLD, 32.5),
    line("2026-10", EntrySource.ITEM_RETURNED, 0, 16),
    line("2026-09", EntrySource.ITEM_SOLD, 80),
    line("2026-09", EntrySource.DAY_CLOSED, 0, 0.1),
  ]);

  it("splits each month into output VAT, refunds and other adjustments", () => {
    expect(report.months).toEqual([
      { month: "2026-09", outputVat: 80, refundedVat: 0, otherAdjustments: -0.1, netVat: 79.9 },
      { month: "2026-10", outputVat: 192.5, refundedVat: 16, otherAdjustments: 0, netVat: 176.5 },
    ]);
  });

  it("totals the period", () => {
    expect(report.total).toEqual({ outputVat: 272.5, refundedVat: 16, otherAdjustments: -0.1, netVat: 256.4 });
  });

  it("is empty with no VAT lines", () => {
    expect(vatByMonth([])).toEqual({
      months: [],
      total: { outputVat: 0, refundedVat: 0, otherAdjustments: 0, netVat: 0 },
    });
  });
});
