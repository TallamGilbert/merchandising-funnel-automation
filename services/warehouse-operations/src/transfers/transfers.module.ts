import { Module } from "@nestjs/common";
import { EventBusModule } from "@mms/shared";
import { InventoryClientModule } from "../inventory-client/inventory-client.module";
import { TransfersController } from "./transfers.controller";
import { TransfersService } from "./transfers.service";

@Module({
  imports: [InventoryClientModule, EventBusModule],
  controllers: [TransfersController],
  providers: [TransfersService],
})
export class TransfersModule {}
