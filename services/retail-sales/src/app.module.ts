import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { CheckoutModule } from "./checkout/checkout.module";
import { ExpectedTotalModule } from "./expected-total/expected-total.module";
import { HealthModule } from "./health/health.module";
import { InventoryGrpcClientModule } from "./inventory-grpc-client/inventory-grpc-client.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ProductsModule } from "./products/products.module";
import { ReturnsModule } from "./returns/returns.module";
import { TransactionsModule } from "./transactions/transactions.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    ProductsModule,
    InventoryGrpcClientModule,
    CheckoutModule,
    ReturnsModule,
    ExpectedTotalModule,
    TransactionsModule,
  ],
})
export class AppModule {}
