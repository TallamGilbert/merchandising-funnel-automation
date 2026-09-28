import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DailyCloseModule } from "./daily-close/daily-close.module";
import { HealthModule } from "./health/health.module";
import { ItemSoldLedgerModule } from "./item-sold-ledger/item-sold-ledger.module";
import { PrismaModule } from "./prisma/prisma.module";
import { RetailSalesClientModule } from "./retail-sales-client/retail-sales-client.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    RetailSalesClientModule,
    ItemSoldLedgerModule,
    DailyCloseModule,
  ],
})
export class AppModule {}
