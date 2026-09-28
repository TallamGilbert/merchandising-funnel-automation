import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HealthModule } from "./health/health.module";
import { LocationsModule } from "./locations/locations.module";
import { PrismaModule } from "./prisma/prisma.module";
import { SeedModule } from "./seed/seed.module";
import { StaffModule } from "./staff/staff.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    LocationsModule,
    StaffModule,
    SeedModule,
  ],
})
export class AppModule {}
