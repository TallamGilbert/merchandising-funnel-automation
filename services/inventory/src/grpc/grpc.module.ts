import { Module } from "@nestjs/common";
import { StockModule } from "../stock/stock.module";
import { InventoryGrpcController } from "./inventory-stock.grpc-controller";

@Module({
  imports: [StockModule],
  controllers: [InventoryGrpcController],
})
export class InventoryGrpcModule {}
