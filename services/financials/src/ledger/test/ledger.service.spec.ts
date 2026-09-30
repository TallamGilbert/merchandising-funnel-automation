import { BadRequestException } from "@nestjs/common";
import { LedgerRepository } from "../ledger.repository";
import { LedgerService, parseDay } from "../ledger.service";

describe("parseDay", () => {
  it("reads a day as its UTC start, or the next day for an inclusive end", () => {
    expect(parseDay("2026-09-25", "from")).toEqual(new Date("2026-09-25T00:00:00Z"));
    expect(parseDay("2026-09-30", "to", true)).toEqual(new Date("2026-10-01T00:00:00Z"));
    expect(parseDay(undefined, "from")).toBeUndefined();
    expect(() => parseDay("25/09/2026", "from")).toThrow(BadRequestException);
  });
});

describe("LedgerService", () => {
  let service: LedgerService;
  let ledger: { findEntries: jest.Mock; totalsByAccount: jest.Mock };

  beforeEach(() => {
    ledger = {
      findEntries: jest.fn().mockResolvedValue([]),
      totalsByAccount: jest.fn().mockResolvedValue([
        { accountCode: "1000", _sum: { debit: 20, credit: 50 } },
        { accountCode: "1200", _sum: { debit: 995, credit: 10 } },
        { accountCode: "2000", _sum: { debit: 0, credit: 995 } },
        { accountCode: "4000", _sum: { debit: 0, credit: 20 } },
        { accountCode: "5000", _sum: { debit: 10, credit: 0 } },
        { accountCode: "6100", _sum: { debit: 50, credit: 0 } },
      ]),
    };
    service = new LedgerService(ledger as unknown as LedgerRepository);
  });

  it("filters entries by an inclusive date range and caps the page size", async () => {
    await service.entries({ from: "2026-09-01", to: "2026-09-30", accountCode: "1200", limit: 5000 });
    expect(ledger.findEntries).toHaveBeenCalledWith({
      from: new Date("2026-09-01T00:00:00Z"),
      to: new Date("2026-10-01T00:00:00Z"),
      accountCode: "1200",
      source: undefined,
      take: 500,
    });
  });

  it("lists every account with its balance on its normal side", async () => {
    const tb = await service.trialBalance("2026-09-30");

    const row = (code: string) => tb.rows.find((r) => r.code === code);
    expect(row("1200")?.balance).toBe(985); // asset: debit - credit
    expect(row("2000")?.balance).toBe(995); // liability: credit - debit
    expect(row("4000")?.balance).toBe(20);
    expect(row("1000")?.balance).toBe(-30); // more cash out than in shows negative
    expect(row("1010")).toEqual(expect.objectContaining({ debit: 0, credit: 0, balance: 0 }));
    expect(tb).toEqual(expect.objectContaining({ totalDebit: 1075, totalCredit: 1075, balanced: true }));
    expect(ledger.totalsByAccount).toHaveBeenCalledWith(new Date("2026-10-01T00:00:00Z"));
  });
});
