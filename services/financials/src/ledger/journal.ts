import { EntrySource } from "../generated/prisma";
import { toCents } from "./money";

export interface JournalLineDraft {
  accountCode: string;
  debit?: number;
  credit?: number;
  memo?: string;
}

export interface JournalDraft {
  occurredAt: Date;
  source: EntrySource;
  sourceRef: string;
  description: string;
  storeId?: string;
  lines: JournalLineDraft[];
}

export class UnbalancedEntryError extends Error {}

/**
 * Double entry's one rule: debits equal credits. Also drops zero lines and
 * rejects negative amounts, so a line's side always says which way it moved.
 */
export function balanced(draft: JournalDraft): JournalDraft {
  const lines = draft.lines.filter((l) => toCents(l.debit ?? 0) !== 0 || toCents(l.credit ?? 0) !== 0);
  let debits = 0;
  let credits = 0;
  for (const line of lines) {
    const debit = toCents(line.debit ?? 0);
    const credit = toCents(line.credit ?? 0);
    if (debit < 0 || credit < 0) {
      throw new UnbalancedEntryError(`${draft.sourceRef}: negative amount on account ${line.accountCode}`);
    }
    if (debit > 0 && credit > 0) {
      throw new UnbalancedEntryError(`${draft.sourceRef}: a line can't both debit and credit ${line.accountCode}`);
    }
    debits += debit;
    credits += credit;
  }
  if (lines.length === 0) throw new UnbalancedEntryError(`${draft.sourceRef}: entry has no amounts`);
  if (debits !== credits) {
    throw new UnbalancedEntryError(
      `${draft.sourceRef}: debits ${(debits / 100).toFixed(2)} ≠ credits ${(credits / 100).toFixed(2)}`,
    );
  }
  return { ...draft, lines };
}
