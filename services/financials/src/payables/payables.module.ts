import { Module } from "@nestjs/common";
import { PayablesController } from "./payables.controller";
import { PayablesRepository } from "./payables.repository";
import { PayablesService } from "./payables.service";

@Module({
  controllers: [PayablesController],
  providers: [PayablesService, PayablesRepository],
  exports: [PayablesRepository],
})
export class PayablesModule {}
