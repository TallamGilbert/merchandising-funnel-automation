import { Module } from "@nestjs/common";
import { ProcurementClientService } from "./procurement-client.service";

@Module({
  providers: [ProcurementClientService],
  exports: [ProcurementClientService],
})
export class ProcurementClientModule {}
