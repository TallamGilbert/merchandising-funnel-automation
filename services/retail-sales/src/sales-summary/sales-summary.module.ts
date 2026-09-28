import { Module } from "@nestjs/common";
import { SalesSummaryController } from "./sales-summary.controller";
import { SalesSummaryRepository } from "./sales-summary.repository";
import { SalesSummaryService } from "./sales-summary.service";

@Module({
  controllers: [SalesSummaryController],
  providers: [SalesSummaryService, SalesSummaryRepository],
})
export class SalesSummaryModule {}
