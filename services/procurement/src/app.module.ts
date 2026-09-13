import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HealthModule } from "./health/health.module";
import { PrismaModule } from "./prisma/prisma.module";
import { PurchaseOrdersModule } from "./purchase-orders/purchase-orders.module";
import { ReorderSuggestionsModule } from "./reorder-suggestions/reorder-suggestions.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    PurchaseOrdersModule,
    ReorderSuggestionsModule,
  ],
})
export class AppModule {}
