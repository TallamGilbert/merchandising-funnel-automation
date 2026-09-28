import { Module } from "@nestjs/common";
import { EventBusModule } from "@mms/shared";
import { LedgerController } from "./ledger.controller";
import { LedgerRepository } from "./ledger.repository";
import { LedgerService } from "./ledger.service";
import { ItemSoldConsumer } from "./item-sold.consumer";

@Module({
  imports: [EventBusModule],
  controllers: [LedgerController],
  providers: [LedgerService, LedgerRepository, ItemSoldConsumer],
  exports: [LedgerService],
})
export class ItemSoldLedgerModule {}
