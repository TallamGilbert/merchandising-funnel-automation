import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ExpectedDeliveriesModule } from "./expected-deliveries/expected-deliveries.module";
import { GrnsModule } from "./grns/grns.module";
import { HealthModule } from "./health/health.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    ExpectedDeliveriesModule,
    GrnsModule,
  ],
})
export class AppModule {}
