import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { BinsModule } from "./bins/bins.module";
import { HealthModule } from "./health/health.module";
import { PrismaModule } from "./prisma/prisma.module";
import { PutawayModule } from "./putaway/putaway.module";
import { TransfersModule } from "./transfers/transfers.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    BinsModule,
    PutawayModule,
    TransfersModule,
  ],
})
export class AppModule {}
