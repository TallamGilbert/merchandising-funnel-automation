import { Controller, Get, Query } from "@nestjs/common";
import { ApiQuery, ApiTags } from "@nestjs/swagger";
import { Exportable, Role, Roles } from "@mms/shared";
import { Prisma } from "../generated/prisma";
import { LedgerService } from "./ledger.service";
import { ListEntriesQuery } from "./list-entries.query";

type EntryWithLines = Prisma.JournalEntryGetPayload<{ include: { lines: { include: { account: true } } } }>;
type LedgerLineRow = { entry: EntryWithLines; line: EntryWithLines["lines"][number] };

@ApiTags("ledger")
@Roles(Role.OWNER, Role.MANAGER, Role.ACCOUNTANT)
@Controller("ledger")
export class LedgerController {
  constructor(private readonly ledger: LedgerService) {}

  @Get("entries")
  @Exportable<LedgerLineRow, EntryWithLines>(
    "journal",
    [
      { header: "Entry", value: (r) => r.entry.sequence },
      { header: "Date", value: (r) => r.entry.occurredAt },
      { header: "Source", value: (r) => r.entry.source },
      { header: "Reference", value: (r) => r.entry.sourceRef },
      { header: "Description", value: (r) => r.entry.description },
      { header: "Store", value: (r) => r.entry.storeId },
      { header: "Account", value: (r) => r.line.accountCode },
      { header: "Account name", value: (r) => r.line.account.name },
      { header: "Debit (KES)", value: (r) => Number(r.line.debit) },
      { header: "Credit (KES)", value: (r) => Number(r.line.credit) },
      { header: "Memo", value: (r) => r.line.memo },
    ],
    // Accountants want the journal one line per row.
    (entries) => entries.flatMap((entry) => entry.lines.map((line) => ({ entry, line }))),
  )
  entries(@Query() query: ListEntriesQuery) {
    return this.ledger.entries(query);
  }

  @Get("trial-balance")
  @ApiQuery({ name: "asOf", required: false, description: "YYYY-MM-DD, inclusive; default today" })
  trialBalance(@Query("asOf") asOf?: string) {
    return this.ledger.trialBalance(asOf);
  }
}
