import { Module } from "@nestjs/common";
import { ExpectedTotalController } from "./expected-total.controller";
import { ExpectedTotalService } from "./expected-total.service";

@Module({
  controllers: [ExpectedTotalController],
  providers: [ExpectedTotalService],
})
export class ExpectedTotalModule {}
