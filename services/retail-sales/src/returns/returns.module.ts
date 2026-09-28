import { Module } from "@nestjs/common";
import { EventBusModule } from "@mms/shared";
import { TransactionsModule } from "../transactions/transactions.module";
import { ReturnsController } from "./returns.controller";
import { ReturnsRepository } from "./returns.repository";
import { ReturnsService } from "./returns.service";

@Module({
  imports: [EventBusModule, TransactionsModule],
  controllers: [ReturnsController],
  providers: [ReturnsService, ReturnsRepository],
  exports: [ReturnsRepository],
})
export class ReturnsModule {}
