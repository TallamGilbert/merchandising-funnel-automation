import { Module } from "@nestjs/common";
import { SalesReportController } from "./sales-report.controller";
import { SalesReportRepository } from "./sales-report.repository";

@Module({
  controllers: [SalesReportController],
  providers: [SalesReportRepository],
})
export class SalesReportModule {}
