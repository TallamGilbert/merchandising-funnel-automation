import { Module } from "@nestjs/common";
import { EventBusModule } from "@mms/shared";
import { LedgerModule } from "../ledger/ledger.module";
import { LookupsModule } from "../lookups/lookups.module";
import { PostingsService } from "../postings/postings.service";
import { InboxConsumer } from "./inbox.consumer";
import { InboxController } from "./inbox.controller";
import { InboxProcessor } from "./inbox.processor";
import { InboxRepository } from "./inbox.repository";

@Module({
  imports: [EventBusModule, LedgerModule, LookupsModule],
  controllers: [InboxController],
  providers: [InboxRepository, InboxProcessor, InboxConsumer, PostingsService],
  exports: [InboxRepository],
})
export class InboxModule {}
