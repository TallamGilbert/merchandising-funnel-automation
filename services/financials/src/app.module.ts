import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HealthModule } from "./health/health.module";
import { PrismaModule } from "./prisma/prisma.module";

/**
 * Scaffold-only module. This service's feature flag is off by default
 * (see root .env.example) until its phase begins — FeatureFlagGuard
 * (applied globally in main.ts) 503s every route except /health until then.
 * Add this module's real domain modules here when its phase starts.
 */
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, HealthModule],
})
export class AppModule {}
