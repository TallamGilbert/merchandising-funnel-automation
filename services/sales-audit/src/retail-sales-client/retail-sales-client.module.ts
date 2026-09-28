import { Module } from "@nestjs/common";
import { RetailSalesClientService } from "./retail-sales-client.service";

@Module({
  providers: [RetailSalesClientService],
  exports: [RetailSalesClientService],
})
export class RetailSalesClientModule {}
