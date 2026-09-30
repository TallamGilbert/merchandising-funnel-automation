import { Module } from "@nestjs/common";
import { InventoryClientService } from "./inventory-client.service";
import { ProcurementClientService } from "./procurement-client.service";

@Module({
  providers: [ProcurementClientService, InventoryClientService],
  exports: [ProcurementClientService, InventoryClientService],
})
export class LookupsModule {}
