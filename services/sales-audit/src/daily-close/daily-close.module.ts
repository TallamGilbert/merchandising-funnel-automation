import { Module } from "@nestjs/common";
import { EventBusModule } from "@mms/shared";
import { ItemSoldLedgerModule } from "../item-sold-ledger/item-sold-ledger.module";
import { RetailSalesClientModule } from "../retail-sales-client/retail-sales-client.module";
import { DailyCloseController } from "./daily-close.controller";
import { DailyCloseService } from "./daily-close.service";

@Module({
  imports: [ItemSoldLedgerModule, RetailSalesClientModule, EventBusModule],
  controllers: [DailyCloseController],
  providers: [DailyCloseService],
})
export class DailyCloseModule {}
