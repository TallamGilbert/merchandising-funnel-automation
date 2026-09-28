import { Module } from "@nestjs/common";
import { ReturnsModule } from "../returns/returns.module";
import { TransactionsModule } from "../transactions/transactions.module";
import { ExpectedTotalController } from "./expected-total.controller";
import { ExpectedTotalService } from "./expected-total.service";

@Module({
  imports: [TransactionsModule, ReturnsModule],
  controllers: [ExpectedTotalController],
  providers: [ExpectedTotalService],
})
export class ExpectedTotalModule {}
