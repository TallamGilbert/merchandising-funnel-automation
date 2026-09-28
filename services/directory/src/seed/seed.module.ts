import { Module } from "@nestjs/common";
import { SeedRepository } from "./seed.repository";
import { SeedService } from "./seed.service";

@Module({
  providers: [SeedService, SeedRepository],
})
export class SeedModule {}
