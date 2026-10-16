import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { EventsModule } from "./events/events.module";
import { InventoryGrpcModule } from "./grpc/grpc.module";
import { HealthModule } from "./health/health.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ProductsModule } from "./products/products.module";
import { ReportsModule } from "./reports/reports.module";
import { StockModule } from "./stock/stock.module";
import { StockCountsModule } from "./stock-counts/stock-counts.module";
import { ValuationModule } from "./valuation/valuation.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    StockModule,
    ProductsModule,
    StockCountsModule,
    ValuationModule,
    ReportsModule,
    EventsModule,
    InventoryGrpcModule,
  ],
})
export class AppModule {}
