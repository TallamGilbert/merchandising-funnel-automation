import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AccountsModule } from "./accounts/accounts.module";
import { HealthModule } from "./health/health.module";
import { InboxModule } from "./inbox/inbox.module";
import { LedgerModule } from "./ledger/ledger.module";
import { PayablesModule } from "./payables/payables.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ReportsModule } from "./reports/reports.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    AccountsModule,
    LedgerModule,
    InboxModule,
    PayablesModule,
    ReportsModule,
  ],
})
export class AppModule {}
