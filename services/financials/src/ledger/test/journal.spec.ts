import { EntrySource } from "../../generated/prisma";
import { balanced, JournalDraft, UnbalancedEntryError } from "../journal";

const draft = (lines: JournalDraft["lines"]): JournalDraft => ({
  occurredAt: new Date("2026-09-25T10:00:00Z"),
  source: EntrySource.ITEM_SOLD,
  sourceRef: "txn-1",
  description: "test",
  lines,
});

describe("balanced", () => {
  it("accepts an entry whose debits equal its credits", () => {
    const entry = balanced(draft([
      { accountCode: "1000", debit: 116 },
      { accountCode: "4000", credit: 100 },
      { accountCode: "2100", credit: 16 },
    ]));
    expect(entry.lines).toHaveLength(3);
  });

  it("balances to the cent despite floating-point sums", () => {
    expect(() =>
      balanced(draft([
        { accountCode: "1000", debit: 0.1 },
        { accountCode: "1000", debit: 0.2 },
        { accountCode: "4000", credit: 0.3 },
      ])),
    ).not.toThrow();
  });

  it("drops zero lines (e.g. no VAT on a zero-rated sale)", () => {
    const entry = balanced(draft([
      { accountCode: "1000", debit: 50 },
      { accountCode: "4000", credit: 50 },
      { accountCode: "2100", credit: 0 },
    ]));
    expect(entry.lines.map((l) => l.accountCode)).toEqual(["1000", "4000"]);
  });

  it("rejects an unbalanced entry", () => {
    expect(() => balanced(draft([
      { accountCode: "1000", debit: 100 },
      { accountCode: "4000", credit: 99.99 },
    ]))).toThrow(UnbalancedEntryError);
  });

  it("rejects negative amounts and lines that debit and credit at once", () => {
    expect(() => balanced(draft([
      { accountCode: "1000", debit: -5 },
      { accountCode: "4000", credit: -5 },
    ]))).toThrow("negative amount");
    expect(() => balanced(draft([{ accountCode: "1000", debit: 5, credit: 5 }]))).toThrow("both debit and credit");
  });

  it("rejects an entry with nothing in it", () => {
    expect(() => balanced(draft([{ accountCode: "1000", debit: 0 }]))).toThrow("no amounts");
  });
});
