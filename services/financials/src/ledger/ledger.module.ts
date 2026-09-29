import { Module } from "@nestjs/common";
import { LedgerController } from "./ledger.controller";
import { LedgerRepository } from "./ledger.repository";
import { LedgerService } from "./ledger.service";

@Module({
  controllers: [LedgerController],
  providers: [LedgerService, LedgerRepository],
  exports: [LedgerRepository],
})
export class LedgerModule {}
