import { Module } from "@nestjs/common";
import { InventoryClientModule } from "../inventory-client/inventory-client.module";
import { TransfersController } from "./transfers.controller";
import { TransfersService } from "./transfers.service";

@Module({
  imports: [InventoryClientModule],
  controllers: [TransfersController],
  providers: [TransfersService],
})
export class TransfersModule {}
