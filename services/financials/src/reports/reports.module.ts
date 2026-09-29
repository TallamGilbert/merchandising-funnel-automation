import { Module } from "@nestjs/common";
import { InboxModule } from "../inbox/inbox.module";
import { LedgerModule } from "../ledger/ledger.module";
import { PayablesModule } from "../payables/payables.module";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";

@Module({
  imports: [LedgerModule, PayablesModule, InboxModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
