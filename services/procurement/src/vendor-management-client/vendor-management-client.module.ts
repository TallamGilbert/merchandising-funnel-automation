import { Module } from "@nestjs/common";
import { VendorManagementClientService } from "./vendor-management-client.service";

@Module({
  providers: [VendorManagementClientService],
  exports: [VendorManagementClientService],
})
export class VendorManagementClientModule {}
