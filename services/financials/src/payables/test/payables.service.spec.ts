import { BadRequestException, NotFoundException } from "@nestjs/common";
import { BillStatus, EntrySource } from "../../generated/prisma";
import { PayablesRepository } from "../payables.repository";
import { agingBucket, daysOverdue, PayablesService } from "../payables.service";

const bill = (id: string, supplierId: string, amount: number, dueDate: string, status: BillStatus = BillStatus.OPEN) => ({
  id,
  goodsReceivedNoteNumber: `GRN-${id}`,
  poNumber: `PO-${id}`,
  supplierId,
  supplierName: supplierId === "s1" ? "Acme Furniture" : "Nairobi Timber",
  amount,
  currency: "KES",
  billDate: new Date("2026-08-01T00:00:00Z"),
  dueDate: new Date(dueDate),
  status,
  paidAt: null,
  paymentReference: null,
  createdAt: new Date(),
});

describe("aging helpers", () => {
  const due = new Date("2026-09-01T00:00:00Z");

  it("counts calendar days past due", () => {
    expect(daysOverdue(due, new Date("2026-09-01T23:59:00Z"))).toBe(0);
    expect(daysOverdue(new Date("2026-09-01T18:00:00Z"), new Date("2026-09-02T01:00:00Z"))).toBe(1);
    expect(daysOverdue(due, new Date("2026-09-11T00:00:00Z"))).toBe(10);
    expect(daysOverdue(due, new Date("2026-08-25T00:00:00Z"))).toBeLessThan(0);
  });

  it.each([
    [-5, "current"],
    [0, "current"],
    [1, "1-30"],
    [30, "1-30"],
    [31, "31-60"],
    [61, "61-90"],
    [91, "90+"],
  ] as const)("puts %i days overdue in %s", (days, bucket) => {
    expect(agingBucket(days)).toBe(bucket);
  });
});

describe("PayablesService", () => {
  let service: PayablesService;
  let payables: { findAll: jest.Mock; findById: jest.Mock; pay: jest.Mock };

  beforeEach(() => {
    payables = {
      findAll: jest.fn().mockResolvedValue([]),
      findById: jest.fn().mockResolvedValue(bill("1", "s1", 995, "2026-10-25T09:00:00Z")),
      pay: jest.fn().mockResolvedValue(true),
    };
    service = new PayablesService(payables as unknown as PayablesRepository);
  });

  it("ages open balances per supplier as of a date", async () => {
    payables.findAll.mockResolvedValue([
      bill("1", "s1", 1000, "2026-09-30T00:00:00Z"), // due on the as-of day → current
      bill("2", "s1", 500, "2026-09-10T00:00:00Z"), // 20 days → 1-30
      bill("3", "s2", 250.5, "2026-06-01T00:00:00Z"), // 121 days → 90+
    ]);

    const report = await service.aging("2026-09-30");

    expect(payables.findAll).toHaveBeenCalledWith({ status: BillStatus.OPEN });
    expect(report.suppliers).toEqual([
      expect.objectContaining({ supplierName: "Acme Furniture", total: 1500, buckets: expect.objectContaining({ current: 1000, "1-30": 500 }) }),
      expect.objectContaining({ supplierName: "Nairobi Timber", total: 250.5, buckets: expect.objectContaining({ "90+": 250.5 }) }),
    ]);
    expect(report.totals).toEqual({ current: 1000, "1-30": 500, "31-60": 0, "61-90": 0, "90+": 250.5 });
    expect(report.totalOutstanding).toBe(1750.5);
  });

  it("pays a bill: Dr Accounts payable, Cr Bank", async () => {
    const paid = await service.pay("1", "MPESA-QX81", "2026-09-29");

    const [, paidAt, reference, entry] = payables.pay.mock.calls[0];
    expect(paidAt).toEqual(new Date("2026-09-29T00:00:00Z"));
    expect(reference).toBe("MPESA-QX81");
    expect(entry).toEqual(
      expect.objectContaining({
        source: EntrySource.BILL_PAYMENT,
        sourceRef: "1",
        lines: [
          expect.objectContaining({ accountCode: "2000", debit: 995 }),
          expect.objectContaining({ accountCode: "1010", credit: 995 }),
        ],
      }),
    );
    expect(paid.status).toBe(BillStatus.PAID);
  });

  it("refuses to pay an unknown or already-paid bill", async () => {
    payables.findById.mockResolvedValueOnce(null);
    await expect(service.pay("nope")).rejects.toBeInstanceOf(NotFoundException);

    payables.findById.mockResolvedValueOnce(bill("1", "s1", 995, "2026-10-25T09:00:00Z", BillStatus.PAID));
    await expect(service.pay("1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("refuses a second concurrent payment the repository rejected", async () => {
    payables.pay.mockResolvedValue(false);
    await expect(service.pay("1")).rejects.toThrow("already paid");
  });

  it("adds how overdue each open bill is", async () => {
    payables.findAll.mockResolvedValue([bill("2", "s1", 500, "2020-01-01T00:00:00Z")]);
    const [row] = await service.list({});
    expect(row.daysOverdue).toBeGreaterThan(90);
    expect(row.agingBucket).toBe("90+");
  });
});
